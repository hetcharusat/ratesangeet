import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Review from '../models/Review.js';

const router = Router();

// Get user profile with follower/following counts
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { viewerId } = req.query as { viewerId?: string };

  const user = await User.findById(id).select('_id spotifyId displayName email profileImage followers following username favAlbums favTracks');
    if (!user) return res.status(404).json({ error: 'User not found' });

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

export default router;

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

// Friends activity feed: recent public reviews from users the viewer follows
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
