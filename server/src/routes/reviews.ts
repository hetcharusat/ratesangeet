import { Router, Request, Response } from 'express';
import Review from '../models/Review.js';
import ReviewComment from '../models/ReviewComment.js';
import User from '../models/User.js';

const router = Router();

// Create a new review
router.post('/', async (req: Request, res: Response) => {
  try {
    const { userId, itemType, spotifyId, itemName, artistName, albumArt, rating, reviewText, isPublic, listeningDate } = req.body;

    if (!userId || !itemType || !spotifyId || !itemName || !artistName || !rating) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({ userId, spotifyId });
    
    if (existingReview) {
      // Update existing review
      existingReview.rating = rating;
      existingReview.reviewText = reviewText;
      existingReview.isPublic = isPublic !== undefined ? isPublic : true;
      existingReview.listeningDate = listeningDate || new Date();
      existingReview.updatedAt = new Date();
      await existingReview.save();
      return res.json(existingReview);
    }

    // Create new review
    const review = new Review({
      userId,
      itemType,
      spotifyId,
      itemName,
      artistName,
      albumArt,
      rating,
      reviewText,
      isPublic: isPublic !== undefined ? isPublic : true, // Public by default
      listeningDate: listeningDate || new Date(),
    });

    await review.save();
    res.status(201).json(review);
  } catch (error: any) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// Get all public reviews (like Letterboxd feed)
router.get('/public', async (req: Request, res: Response) => {
  try {
    const { limit = 50, skip = 0 } = req.query;
    const reviews = await Review.find({ isPublic: true })
      .populate('userId', 'displayName profileImage')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip));
    res.json(reviews);
  } catch (error: any) {
    console.error('Error fetching public reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Get all reviews for a user
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    console.log(`[REVIEWS] Fetching reviews for userId: ${userId}`);
    const reviews = await Review.find({ userId }).sort({ createdAt: -1 });
    console.log(`[REVIEWS] Found ${reviews.length} reviews for userId: ${userId}`);
    res.json(reviews);
  } catch (error: any) {
    console.error('[REVIEWS] Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Get reviews for a specific track/album (all users)
router.get('/track/:spotifyId', async (req: Request, res: Response) => {
  try {
    const { spotifyId } = req.params;
    const reviews = await Review.find({ spotifyId, isPublic: true })
      .populate('userId', 'displayName profileImage')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error: any) {
    console.error('Error fetching track reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Get a specific review
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    res.json(review);
  } catch (error: any) {
    console.error('Error fetching review:', error);
    res.status(500).json({ error: 'Failed to fetch review' });
  }
});

// Update a review
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { rating, reviewText } = req.body;
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (rating) review.rating = rating;
    if (reviewText !== undefined) review.reviewText = reviewText;
    review.updatedAt = new Date();

    await review.save();
    res.json(review);
  } catch (error: any) {
    console.error('Error updating review:', error);
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// Delete a review
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    res.json({ message: 'Review deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting review:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// Get user stats
router.get('/stats/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const totalReviews = await Review.countDocuments({ userId });
    const avgRating = await Review.aggregate([
      { $match: { userId: userId as any } },
      { $group: { _id: null, avgRating: { $avg: '$rating' } } },
    ]);

    res.json({
      totalReviews,
      averageRating: avgRating[0]?.avgRating || 0,
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// React to a review with limited emoji types
router.post('/:id/react', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId, type } = req.body as { userId?: string; type?: string | null };

    if (!userId) return res.status(400).json({ error: 'userId required' });

    // Support both emoji reactions and YouTube-style like/dislike
    const allowed: Record<string, string> = { 
      like: '👍', 
      dislike: '👎',  // Added dislike support
      love: '❤️', 
      fire: '🔥', 
      sad: '😢',
      none: ''  // For removing reactions
    };
    if (type && type !== 'none' && !allowed[type]) {
      return res.status(400).json({ error: 'Invalid reaction type' });
    }

    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ error: 'Review not found' });

    const current = (review.reactionsByUser as any)?.get?.(userId) as string | undefined;

    // Initialize maps if missing
    if (!review.reactionsByUser) (review as any).reactionsByUser = new Map();
    if (!review.reactionsCount) (review as any).reactionsCount = new Map();

    // Helper to adjust counts safely
    const dec = (t: string) => {
      const prev = Number((review.reactionsCount as any).get(t) || 0);
      (review.reactionsCount as any).set(t, Math.max(0, prev - 1));
    };
    const inc = (t: string) => {
      const prev = Number((review.reactionsCount as any).get(t) || 0);
      (review.reactionsCount as any).set(t, prev + 1);
    };

    // Remove previous reaction if exists
    if (current) {
      dec(current);
      (review.reactionsByUser as any).delete(userId);
    }

    // Add new reaction if provided (not 'none' and not empty)
    if (type && type !== 'none') {
      inc(type);
      (review.reactionsByUser as any).set(userId, type);
    }

    // Optional: keep legacy likes as sum of positive reactions
    const likeSum = ['like', 'love', 'fire']
      .map((t) => Number((review.reactionsCount as any).get(t) || 0))
      .reduce((a, b) => a + b, 0);
    review.likes = likeSum;

    review.updatedAt = new Date();
    await review.save();

    // Build a plain object response with counts and the user's reaction
    const countsObj: Record<string, number> = {};
    for (const [k, v] of (review.reactionsCount as any).entries?.() || []) {
      countsObj[k] = Number(v) || 0;
    }
    const userReaction = (review.reactionsByUser as any).get?.(userId) || null;

    res.json({
      success: true,
      reviewId: review._id,
      reactionsCount: countsObj,
      userReaction,
      likes: review.likes,
    });
  } catch (error: any) {
    console.error('Error reacting to review:', error);
    res.status(500).json({ error: 'Failed to update reaction' });
  }
});

// Get users who reacted to a review (for showing like/dislike lists)
router.get('/:id/reactions/users', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type } = req.query as { type?: string };

    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ error: 'Review not found' });

    if (!review.reactionsByUser) {
      return res.json({ users: [] });
    }

    // Get all userIds who reacted with the specified type (or all if no type specified)
    const userIds: string[] = [];
    for (const [userId, reactionType] of (review.reactionsByUser as any).entries?.() || []) {
      if (!type || reactionType === type) {
        userIds.push(userId);
      }
    }

    // Fetch user details
    const users = await User.find({ _id: { $in: userIds } })
      .select('displayName profileImage username spotifyId')
      .lean();

    // Map users with their reaction types
    const usersWithReactions = users.map((u: any) => ({
      _id: u._id,
      displayName: u.displayName,
      profileImage: u.profileImage,
      username: u.username,
      spotifyId: u.spotifyId,
      reactionType: (review.reactionsByUser as any).get(String(u._id)),
    }));

    res.json({ users: usersWithReactions });
  } catch (error: any) {
    console.error('Error fetching reaction users:', error);
    res.status(500).json({ error: 'Failed to fetch reaction users' });
  }
});

// List comments for a review (flat list with parentId references)
router.get('/:id/comments', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const comments = await ReviewComment.find({ reviewId: id })
      .populate('userId', 'displayName profileImage username')
      .sort({ createdAt: 1 })
      .lean();
    res.json(comments);
  } catch (error: any) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Add a comment (or reply) to a review
router.post('/:id/comments', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId, text, parentId } = req.body as { userId?: string; text?: string; parentId?: string | null };

    if (!userId || !text || !text.trim()) {
      return res.status(400).json({ error: 'userId and text required' });
    }

    // ensure review exists
    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ error: 'Review not found' });

    // if replying, ensure parent exists and belongs to same review
    if (parentId) {
      const parent = await ReviewComment.findById(parentId);
      if (!parent || String(parent.reviewId) !== String(id)) {
        return res.status(400).json({ error: 'Invalid parent comment' });
      }
    }

    const created = await ReviewComment.create({
      reviewId: id as any,
      userId: userId as any,
      text: text.trim(),
      parentId: parentId || null,
    });

    const populated = await created.populate('userId', 'displayName profileImage username');
    res.status(201).json(populated);
  } catch (error: any) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Delete a comment (author-only)
router.delete('/comments/:commentId', async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const { userId } = req.body as { userId?: string };
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const comment = await ReviewComment.findById(commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (String(comment.userId) !== String(userId)) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    await comment.deleteOne();
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;
