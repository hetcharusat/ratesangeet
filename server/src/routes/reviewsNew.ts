import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as controller from '../controllers/reviewsController.js';

const router = Router();

// Reviews CRUD
router.post('/', asyncHandler(controller.createReview));
router.get('/public', asyncHandler(controller.getPublicReviews));
router.get('/user/:userId', asyncHandler(controller.getUserReviews));
router.get('/track/:spotifyId', asyncHandler(controller.getTrackReviews));
router.get('/stats/:userId', asyncHandler(controller.getUserStats));
router.get('/:id', asyncHandler(controller.getReviewById));
router.put('/:id', asyncHandler(controller.updateReview));
router.delete('/:id', asyncHandler(controller.deleteReview));

// Reactions
router.post('/:id/react', asyncHandler(controller.reactToReview));
router.get('/:id/reactions/users', asyncHandler(controller.getReactionUsers));

// Comments
router.get('/:id/comments', asyncHandler(controller.getReviewComments));
router.post('/:id/comments', asyncHandler(controller.addReviewComment));
router.delete('/comments/:commentId', asyncHandler(controller.deleteReviewComment));

export default router;
