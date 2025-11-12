import { Router } from 'express';
import musicRoutes from '../music';
import discoverRoutes from '../discover';

// Group Spotify-related capabilities: search, artist, album, playback, sync
const router = Router();

// All music routes under /api/spotify/*
router.use('/', musicRoutes);

// Discover feed under /api/spotify/discover/*
router.use('/discover', discoverRoutes);

export default router;
