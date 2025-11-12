import { Request, Response } from 'express';
import Review from '../models/Review.js';
import ReviewComment from '../models/ReviewComment.js';
import User from '../models/User.js';
import * as respond from '../utils/response.js';

export async function createReview(req: Request, res: Response) {
  const { userId, itemType, spotifyId, itemName, artistName, albumArt, rating, reviewText, isPublic, listeningDate } = req.body;

  if (!userId || !itemType || !spotifyId || !itemName || !artistName || !rating) {
    return respond.error(res, 'Missing required fields', 400);
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
    return respond.success(res, existingReview);
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
    isPublic: isPublic !== undefined ? isPublic : true,
    listeningDate: listeningDate || new Date(),
  });

  await review.save();
  respond.success(res, review, 201);
}

export async function getPublicReviews(req: Request, res: Response) {
  const { limit = 50, skip = 0 } = req.query;
  const reviews = await Review.find({ isPublic: true })
    .populate('userId', 'displayName profileImage')
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .skip(Number(skip));
  respond.success(res, reviews);
}

export async function getUserReviews(req: Request, res: Response) {
  const { userId } = req.params;
  const reviews = await Review.find({ userId }).sort({ createdAt: -1 });
  respond.success(res, reviews);
}

export async function getTrackReviews(req: Request, res: Response) {
  const { spotifyId } = req.params;
  const reviews = await Review.find({ spotifyId, isPublic: true })
    .populate('userId', 'displayName profileImage')
    .sort({ createdAt: -1 });
  respond.success(res, reviews);
}

export async function getReviewById(req: Request, res: Response) {
  const review = await Review.findById(req.params.id);
  if (!review) {
    return respond.error(res, 'Review not found', 404);
  }
  respond.success(res, review);
}

export async function updateReview(req: Request, res: Response) {
  const { rating, reviewText } = req.body;
  const review = await Review.findById(req.params.id);

  if (!review) {
    return respond.error(res, 'Review not found', 404);
  }

  if (rating) review.rating = rating;
  if (reviewText !== undefined) review.reviewText = reviewText;
  review.updatedAt = new Date();

  await review.save();
  respond.success(res, review);
}

export async function deleteReview(req: Request, res: Response) {
  const review = await Review.findByIdAndDelete(req.params.id);
  if (!review) {
    return respond.error(res, 'Review not found', 404);
  }
  respond.success(res, { message: 'Review deleted successfully' });
}

export async function getUserStats(req: Request, res: Response) {
  const { userId } = req.params;
  
  const totalReviews = await Review.countDocuments({ userId });
  const avgRating = await Review.aggregate([
    { $match: { userId: userId as any } },
    { $group: { _id: null, avgRating: { $avg: '$rating' } } },
  ]);

  respond.success(res, {
    totalReviews,
    averageRating: avgRating[0]?.avgRating || 0,
  });
}

export async function reactToReview(req: Request, res: Response) {
  const { id } = req.params;
  const { userId, type } = req.body as { userId?: string; type?: string | null };

  if (!userId) return respond.error(res, 'userId required', 400);

  const allowed: Record<string, string> = { 
    like: '👍', 
    dislike: '👎',
    love: '❤️', 
    fire: '🔥', 
    sad: '😢',
    none: ''
  };
  if (type && type !== 'none' && !allowed[type]) {
    return respond.error(res, 'Invalid reaction type', 400);
  }

  const review = await Review.findById(id);
  if (!review) return respond.error(res, 'Review not found', 404);

  const current = (review.reactionsByUser as any)?.get?.(userId) as string | undefined;

  if (!review.reactionsByUser) (review as any).reactionsByUser = new Map();
  if (!review.reactionsCount) (review as any).reactionsCount = new Map();

  const dec = (t: string) => {
    const prev = Number((review.reactionsCount as any).get(t) || 0);
    (review.reactionsCount as any).set(t, Math.max(0, prev - 1));
  };
  const inc = (t: string) => {
    const prev = Number((review.reactionsCount as any).get(t) || 0);
    (review.reactionsCount as any).set(t, prev + 1);
  };

  if (current) {
    dec(current);
    (review.reactionsByUser as any).delete(userId);
  }

  if (type && type !== 'none') {
    inc(type);
    (review.reactionsByUser as any).set(userId, type);
  }

  const likeSum = ['like', 'love', 'fire']
    .map((t) => Number((review.reactionsCount as any).get(t) || 0))
    .reduce((a, b) => a + b, 0);
  review.likes = likeSum;

  review.updatedAt = new Date();
  await review.save();

  const countsObj: Record<string, number> = {};
  for (const [k, v] of (review.reactionsCount as any).entries?.() || []) {
    countsObj[k] = Number(v) || 0;
  }
  const userReaction = (review.reactionsByUser as any).get?.(userId) || null;

  respond.success(res, {
    reviewId: review._id,
    reactionsCount: countsObj,
    userReaction,
    likes: review.likes,
  });
}

export async function getReactionUsers(req: Request, res: Response) {
  const { id } = req.params;
  const { type } = req.query as { type?: string };

  const review = await Review.findById(id);
  if (!review) return respond.error(res, 'Review not found', 404);

  const userIds: string[] = [];
  if (!type) {
    for (const [uid] of (review.reactionsByUser as any).entries?.() || []) {
      userIds.push(uid);
    }
  } else {
    for (const [uid, rtype] of (review.reactionsByUser as any).entries?.() || []) {
      if (rtype === type) userIds.push(uid);
    }
  }

  if (userIds.length === 0) {
    return respond.success(res, []);
  }

  const users = await User.find({ _id: { $in: userIds } }).select('_id displayName profileImage username');
  respond.success(res, users);
}

export async function getReviewComments(req: Request, res: Response) {
  const { id } = req.params;
  const comments = await ReviewComment.find({ reviewId: id })
    .populate('userId', 'displayName profileImage username')
    .sort({ createdAt: 1 });
  respond.success(res, comments);
}

export async function addReviewComment(req: Request, res: Response) {
  const { id } = req.params;
  const { userId, text } = req.body;

  if (!userId || !text) {
    return respond.error(res, 'userId and text required', 400);
  }

  const review = await Review.findById(id);
  if (!review) {
    return respond.error(res, 'Review not found', 404);
  }

  const comment = new ReviewComment({
    reviewId: id,
    userId,
    text,
  });
  await comment.save();

  const populated = await ReviewComment.findById(comment._id)
    .populate('userId', 'displayName profileImage username');

  respond.success(res, populated, 201);
}

export async function deleteReviewComment(req: Request, res: Response) {
  const { commentId } = req.params;
  const comment = await ReviewComment.findByIdAndDelete(commentId);
  if (!comment) {
    return respond.error(res, 'Comment not found', 404);
  }
  respond.success(res, { message: 'Comment deleted successfully' });
}
