import { Router } from 'express';
import usersRoutes from '../users.js';
import authRoutes from '../auth.js';

// Group user-related capabilities: profiles, social graph, and auth helpers
const router = Router();

// Mount user profile and social routes at /api/user/*
router.use('/', usersRoutes);

// Mount auth routes at /api/user/* (e.g., /api/user/login)
// Legacy paths still available under /api/auth via unified loader
router.use('/', authRoutes);

export default router;
