import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Review from '../models/Review.js';
import Scrobble from '../models/Scrobble.js';

const router = Router();

// Search users with pagination and text indexing
router.get('/', async (req: Request, res: Response) => {
  try {
    const { query, page = '1', limit = '20' } = req.query as { query?: string; page?: string; limit?: string };
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit))); // Max 50 results per page
    const skip = (pageNum - 1) * limitNum;

    // Case-insensitive regex search on username and displayName
    // Using text index would be faster but requires explicit index creation
    const searchRegex = new RegExp(query.trim(), 'i');
    
    const [users, totalCount] = await Promise.all([
      User.find({
        $or: [
          { username: searchRegex },
          { displayName: searchRegex }
        ]
      })
        .select('_id username displayName profileImage followers following')
        .limit(limitNum)
        .skip(skip)
        .lean(),
      
      User.countDocuments({
        $or: [
          { username: searchRegex },
          { displayName: searchRegex }
        ]
      })
    ]);

    const results = users.map(user => ({
      _id: user._id,
      username: user.username,
      displayName: user.displayName,
      profileImage: user.profileImage,
      followersCount: (user.followers as any[])?.length || 0,
      followingCount: (user.following as any[])?.length || 0,
    }));

    res.json({
      results,
      page: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      totalCount,
      hasMore: skip + results.length < totalCount,
    });
  } catch (error: any) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// ============================================================================
// SPECIFIC ROUTES - These MUST come BEFORE the generic /:id route
// ============================================================================

// Get user's activity feed (reviews from people they follow)
router.get('/:id/feed', async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // viewer user id
    const { limit = 50, skip = 0 } = req.query as any;

    const viewer = await User.findById(id).select('following');
    if (!viewer) return res.status(404).json({ error: 'Viewer not found' });

    const followingIds = viewer.following?.map((u: any) => String(u)) || [];
    if (followingIds.length === 0) return res.json([]);

    const feedDocs = await Review.find({ userId: { $in: followingIds }, isPublic: true })
      .populate('userId', 'displayName profileImage')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip));

    const feed = feedDocs.map((doc: any) => {
      const obj = doc.toObject();
      // reactionsCount -> plain object
      const counts: Record<string, number> = {};
      const rc = doc.reactionsCount as Map<string, number> | undefined;
      if (rc && typeof (rc as any).forEach === 'function') {
        (rc as any).forEach((v: number, k: string) => { counts[k] = Number(v) || 0; });
      }
      const userReaction = doc.reactionsByUser?.get?.(String(id)) || null;
      delete obj.reactionsByUser;
      return { ...obj, reactionsCount: counts, userReaction };
    });

    res.json(feed);
  } catch (error) {
    console.error('Error fetching friends feed:', error);
    res.status(500).json({ error: 'Failed to fetch friends feed' });
  }
});

// Get user's recent activity (last scrobble + recent reviews)
router.get('/:id/activity', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reviewLimit = '5' } = req.query as { reviewLimit?: string };

    const reviewLimitNum = Math.min(10, Math.max(1, parseInt(reviewLimit)));

    // Get last scrobble
    const lastScrobble = await Scrobble.findOne({ userId: id })
      .sort({ playedAt: -1 })
      .select('trackName artistName albumArt playedAt')
      .lean();

    // Get recent reviews
    const recentReviews = await Review.find({ userId: id, isPublic: true })
      .sort({ createdAt: -1 })
      .limit(reviewLimitNum)
      .select('itemType spotifyId itemName artistName albumArt rating reviewText createdAt likes')
      .lean();

    res.json({
      lastScrobble: lastScrobble ? {
        trackName: lastScrobble.trackName,
        artistName: lastScrobble.artistName,
        albumArt: lastScrobble.albumArt,
        playedAt: lastScrobble.playedAt,
      } : null,
      recentReviews: recentReviews.map(r => ({
        _id: r._id,
        itemType: r.itemType,
        spotifyId: r.spotifyId,
        itemName: r.itemName,
        artistName: r.artistName,
        albumArt: r.albumArt,
        rating: r.rating,
        reviewText: r.reviewText,
        createdAt: r.createdAt,
        likes: r.likes,
      })),
    });
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
});

// Get mutual followers between two users
router.get('/:id/mutual-followers', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { viewerId } = req.query as { viewerId?: string };

    if (!viewerId) {
      return res.status(400).json({ error: 'viewerId required' });
    }

    const [user, viewer] = await Promise.all([
      User.findById(id).select('followers').lean(),
      User.findById(viewerId).select('followers').lean(),
    ]);

    if (!user || !viewer) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userFollowerIds = (user.followers as any[])?.map(f => String(f)) || [];
    const viewerFollowerIds = (viewer.followers as any[])?.map(f => String(f)) || [];

    const mutualIds = userFollowerIds.filter(id => viewerFollowerIds.includes(id));

    if (mutualIds.length === 0) {
      return res.json({ mutualFollowers: [], count: 0 });
    }

    const mutualUsers = await User.find({ _id: { $in: mutualIds } })
      .select('_id username displayName profileImage')
      .limit(10) // Max 10 avatars to display
      .lean();

    res.json({
      mutualFollowers: mutualUsers.map(u => ({
        _id: u._id,
        username: u.username,
        displayName: u.displayName,
        profileImage: u.profileImage,
      })),
      count: mutualIds.length,
    });
  } catch (error) {
    console.error('Error fetching mutual followers:', error);
    res.status(500).json({ error: 'Failed to fetch mutual followers' });
  }
});

// Get followers list for a user (IDs who follow this user)
router.get('/:id/followers', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '50' } = req.query as { limit?: string };
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    const user = await User.findById(id).select('followers').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const followerIds = (user.followers as any[])?.map(f => String(f)) || [];
    if (followerIds.length === 0) return res.json({ followers: [], count: 0 });
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const followers = await User.find({ _id: { $in: followerIds } })
      .select('_id displayName username profileImage')
      .limit(limitNum)
      .lean();
    res.json({
      followers: followers.map(u => ({
        _id: u._id,
        displayName: u.displayName,
        username: u.username,
        profileImage: u.profileImage,
      })),
      count: followerIds.length,
    });
  } catch (error) {
    console.error('Error fetching followers list:', error);
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

// Get following list for a user (IDs this user follows)
router.get('/:id/following', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '50' } = req.query as { limit?: string };
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    const user = await User.findById(id).select('following').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const followingIds = (user.following as any[])?.map(f => String(f)) || [];
    if (followingIds.length === 0) return res.json({ following: [], count: 0 });
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const following = await User.find({ _id: { $in: followingIds } })
      .select('_id displayName username profileImage')
      .limit(limitNum)
      .lean();
    res.json({
      following: following.map(u => ({
        _id: u._id,
        displayName: u.displayName,
        username: u.username,
        profileImage: u.profileImage,
      })),
      count: followingIds.length,
    });
  } catch (error) {
    console.error('Error fetching following list:', error);
    res.status(500).json({ error: 'Failed to fetch following' });
  }
});

// ============================================================================
// GENERIC ROUTE - Must come AFTER all specific /:id/* routes
// ============================================================================

// Get user profile with follower/following counts
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { viewerId } = req.query as { viewerId?: string };

    // ROOT FIX: Validate userId before querying
    if (!id || id === 'undefined' || id === 'null') {
      console.log('[GET /users/:id] Invalid user ID:', id);
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('[GET /users/:id] Invalid MongoDB ObjectId:', id);
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const user = await User.findById(id).select('_id spotifyId displayName email profileImage followers following username bio instagramUsername twitterHandle location favAlbums favTracks');
    if (!user) {
      console.log('[GET /users/:id] User not found:', id);
      return res.status(404).json({ error: 'User not found' });
    }

    const followersCount = user.followers?.length || 0;
    const followingCount = user.following?.length || 0;
    const isFollowing = viewerId ? user.followers?.some(u => String(u) === String(viewerId)) : false;

    res.json({
      _id: user._id,
      spotifyId: user.spotifyId,
      displayName: user.displayName,
      email: user.email,
      profileImage: user.profileImage,
      username: user.username,
      bio: user.bio,
      instagramUsername: user.instagramUsername,
      twitterHandle: user.twitterHandle,
      location: user.location,
      favAlbums: user.favAlbums || [],
      favTracks: user.favTracks || [],
      followersCount,
      followingCount,
      isFollowing,
    });
  } catch (error: any) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Follow user
router.post('/:id/follow', async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // target user
    const { followerId } = req.body as { followerId?: string };

    if (!followerId) return res.status(400).json({ error: 'followerId required' });
    if (id === followerId) return res.status(400).json({ error: 'Cannot follow yourself' });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const target = await User.findByIdAndUpdate(id, { $addToSet: { followers: followerId } }, { new: true, session });
      const follower = await User.findByIdAndUpdate(followerId, { $addToSet: { following: id } }, { new: true, session });

      if (!target || !follower) {
        await session.abortTransaction();
        return res.status(404).json({ error: 'User not found' });
      }

      await session.commitTransaction();
      res.json({
        followersCount: target.followers.length,
        followingCount: follower.following.length,
        isFollowing: true,
      });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (error: any) {
    console.error('Error following user:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

// Unfollow user
router.post('/:id/unfollow', async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // target user
    const { followerId } = req.body as { followerId?: string };

    if (!followerId) return res.status(400).json({ error: 'followerId required' });
    if (id === followerId) return res.status(400).json({ error: 'Cannot unfollow yourself' });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const target = await User.findByIdAndUpdate(id, { $pull: { followers: followerId } }, { new: true, session });
      const follower = await User.findByIdAndUpdate(followerId, { $pull: { following: id } }, { new: true, session });

      if (!target || !follower) {
        await session.abortTransaction();
        return res.status(404).json({ error: 'User not found' });
      }

      await session.commitTransaction();
      res.json({
        followersCount: target.followers.length,
        followingCount: follower.following.length,
        isFollowing: false,
      });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (error: any) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// Update username
router.put('/:id/username', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { username } = req.body as { username?: string };
    if (!username || !/^[a-z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ error: 'Invalid username (3-20 chars, a-z, 0-9, underscore)' });
    }
    const existing = await User.findOne({ username, _id: { $ne: id } });
    if (existing) return res.status(409).json({ error: 'Username already taken' });

    const updated = await User.findByIdAndUpdate(id, { username }, { new: true });
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, username: updated.username });
  } catch (error) {
    console.error('Error updating username:', error);
    res.status(500).json({ error: 'Failed to update username' });
  }
});

// Update full profile (bio, social links, location)
router.put('/:id/profile', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { bio, instagramUsername, twitterHandle, location } = req.body as {
      bio?: string;
      instagramUsername?: string;
      twitterHandle?: string;
      location?: string;
    };

    const updates: any = {};
    
    if (bio !== undefined) {
      if (bio.length > 200) {
        return res.status(400).json({ error: 'Bio must be 200 characters or less' });
      }
      updates.bio = bio.trim();
    }
    
    if (instagramUsername !== undefined) {
      // Remove @ symbol if present
      updates.instagramUsername = instagramUsername.replace(/^@/, '').trim();
    }
    
    if (twitterHandle !== undefined) {
      // Remove @ symbol if present
      updates.twitterHandle = twitterHandle.replace(/^@/, '').trim();
    }
    
    if (location !== undefined) {
      if (location.length > 50) {
        return res.status(400).json({ error: 'Location must be 50 characters or less' });
      }
      updates.location = location.trim();
    }

    const updated = await User.findByIdAndUpdate(id, updates, { new: true })
      .select('bio instagramUsername twitterHandle location');
      
    if (!updated) return res.status(404).json({ error: 'User not found' });
    
    res.json({
      success: true,
      bio: updated.bio,
      instagramUsername: updated.instagramUsername,
      twitterHandle: updated.twitterHandle,
      location: updated.location,
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Update favorites (max 4 each)
router.put('/:id/favorites', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { favAlbums, favTracks } = req.body as {
      favAlbums?: Array<{ id: string; name: string; artist: string; image?: string }>;
      favTracks?: Array<{ id: string; name: string; artist: string; image?: string }>;
    };

    const sanitize = (arr: any[] | undefined) =>
      Array.isArray(arr)
        ? arr
            .filter((x) => x && x.id && x.name)
            .slice(0, 4)
            .map((x) => ({ id: String(x.id), name: String(x.name), artist: String(x.artist || ''), image: x.image ? String(x.image) : undefined }))
        : undefined;

    const updates: any = {};
    const a = sanitize(favAlbums);
    const t = sanitize(favTracks);
    if (a) updates.favAlbums = a;
    if (t) updates.favTracks = t;

    const updated = await User.findByIdAndUpdate(id, updates, { new: true });
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, favAlbums: updated.favAlbums || [], favTracks: updated.favTracks || [] });
  } catch (error) {
    console.error('Error updating favorites:', error);
    res.status(500).json({ error: 'Failed to update favorites' });
  }
});

export default router;