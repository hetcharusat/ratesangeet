import { Router, Request, Response } from 'express';
import ReviewComment from '../models/ReviewComment';
import Review from '../models/Review';
import User from '../models/User';
import mongoose from 'mongoose';

const router = Router();

// Get comments for a review (with nested threading)
router.get('/:reviewId', async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;

    // Fetch all comments for this review
    const allComments = await ReviewComment.find({ reviewId })
      .sort({ createdAt: 1 }) // Chronological order
      .lean();

    // Build threaded structure
    const commentMap = new Map();
    const rootComments: any[] = [];

    // First pass: create map and initialize arrays
    allComments.forEach((comment: any) => {
      commentMap.set(comment._id.toString(), {
        ...comment,
        replies: [],
      });
    });

    // Second pass: build tree structure
    allComments.forEach((comment: any) => {
      const commentWithReplies = commentMap.get(comment._id.toString());
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId.toString());
        if (parent) {
          parent.replies.push(commentWithReplies);
        }
      } else {
        rootComments.push(commentWithReplies);
      }
    });

    res.json({ comments: rootComments });
  } catch (error: any) {
    console.error('[GET /comments/:reviewId] Error:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Post a comment (or reply)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { reviewId, userId, text, parentId } = req.body;

    if (!reviewId || !userId || !text?.trim()) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get user info for denormalization
    const user = await User.findById(userId).select('username');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate depth
    let depth = 0;
    if (parentId) {
      const parentComment = await ReviewComment.findById(parentId);
      if (parentComment) {
        depth = parentComment.depth + 1;
        // Update parent's reply count
        await ReviewComment.findByIdAndUpdate(parentId, {
          $inc: { replyCount: 1 },
        });
      }
    }

    // Create comment
    const comment = new ReviewComment({
      reviewId,
      userId,
      username: user.username,
      text: text.trim(),
      parentId: parentId || null,
      depth,
      replyCount: 0,
      reactionsCount: {},
      reactionsByUser: {},
    });

    await comment.save();

    res.status(201).json({ comment });
  } catch (error: any) {
    console.error('[POST /comments] Error:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// React to a comment (single-select emoji)
router.post('/:commentId/react', async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const { userId, reactionType } = req.body;

    console.log('[POST /comments/:commentId/react] Request:', { commentId, userId, reactionType });

    if (!userId || !reactionType) {
      return res.status(400).json({ error: 'Missing userId or reactionType' });
    }

    const comment = await ReviewComment.findById(commentId);
    if (!comment) {
      console.log('[POST /comments/:commentId/react] Comment not found:', commentId);
      return res.status(404).json({ error: 'Comment not found' });
    }

    console.log('[POST /comments/:commentId/react] Before update:', {
      reactionsCount: Object.fromEntries(comment.reactionsCount || new Map()),
      reactionsByUser: Object.fromEntries(comment.reactionsByUser || new Map())
    });

    const reactionsCount = comment.reactionsCount || new Map();
    const reactionsByUser = comment.reactionsByUser || new Map();
    const previousReaction = reactionsByUser.get(userId);

    // Remove previous reaction count
    if (previousReaction && reactionsCount.has(previousReaction)) {
      const count = reactionsCount.get(previousReaction) || 0;
      if (count > 1) {
        reactionsCount.set(previousReaction, count - 1);
      } else {
        reactionsCount.delete(previousReaction);
      }
    }

    // If same reaction, remove it (toggle off)
    if (previousReaction === reactionType) {
      reactionsByUser.delete(userId);
    } else {
      // Add new reaction
      reactionsByUser.set(userId, reactionType);
      reactionsCount.set(reactionType, (reactionsCount.get(reactionType) || 0) + 1);
    }

    comment.reactionsCount = reactionsCount;
    comment.reactionsByUser = reactionsByUser;
    await comment.save();

    console.log('[POST /comments/:commentId/react] After update:', {
      reactionsCount: Object.fromEntries(comment.reactionsCount || new Map()),
      reactionsByUser: Object.fromEntries(comment.reactionsByUser || new Map())
    });

    res.json({ comment });
  } catch (error: any) {
    console.error('[POST /comments/:commentId/react] Error:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Delete a comment (and cascade delete replies)
router.delete('/:commentId', async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const { userId } = req.body;

    const comment = await ReviewComment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check ownership
    if (comment.userId.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    // Recursively delete all replies
    const deleteRecursive = async (parentId: string) => {
      const replies = await ReviewComment.find({ parentId });
      for (const reply of replies) {
        const replyId = (reply._id as mongoose.Types.ObjectId).toString();
        await deleteRecursive(replyId);
        await ReviewComment.findByIdAndDelete(reply._id);
      }
    };

    await deleteRecursive(commentId);
    await ReviewComment.findByIdAndDelete(commentId);

    // Update parent's reply count if this was a reply
    if (comment.parentId) {
      await ReviewComment.findByIdAndUpdate(comment.parentId, {
        $inc: { replyCount: -1 },
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE /comments/:commentId] Error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// React to a review (single-select emoji)
router.post('/reviews/:reviewId/react', async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { userId, reactionType } = req.body;

    if (!userId || !reactionType) {
      return res.status(400).json({ error: 'Missing userId or reactionType' });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const reactionsCount = review.reactionsCount || new Map();
    const reactionsByUser = review.reactionsByUser || new Map();
    const previousReaction = reactionsByUser.get(userId);

    // Remove previous reaction count
    if (previousReaction && reactionsCount.has(previousReaction)) {
      const count = reactionsCount.get(previousReaction) || 0;
      if (count > 1) {
        reactionsCount.set(previousReaction, count - 1);
      } else {
        reactionsCount.delete(previousReaction);
      }
    }

    // If same reaction, remove it (toggle off)
    if (previousReaction === reactionType) {
      reactionsByUser.delete(userId);
    } else {
      // Add new reaction
      reactionsByUser.set(userId, reactionType);
      reactionsCount.set(reactionType, (reactionsCount.get(reactionType) || 0) + 1);
    }

    review.reactionsCount = reactionsCount;
    review.reactionsByUser = reactionsByUser;
    await review.save();

    res.json({ review });
  } catch (error: any) {
    console.error('[POST /reviews/:reviewId/react] Error:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

export default router;
