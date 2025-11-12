import { Router } from 'express';
import reviewRoutesNew from '../reviewsNew.js'; // Refactored with controllers
import reviewRoutesLegacy from '../reviews.js'; // Original for backward compat
import commentsRoutes from '../comments.js';

// Group reviews, reactions, comments under /api/reviews/*
const router = Router();

// Use new controller-based routes on grouped path
router.use('/', reviewRoutesNew);

export default router;
