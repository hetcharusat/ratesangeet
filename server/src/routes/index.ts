import { Router } from 'express';
import userGroup from './groups/user';
import spotifyGroup from './groups/spotify';
import reviewsGroup from './groups/reviews';
import statsGroup from './groups/stats';

// Legacy routers (preserve existing paths for backward compatibility)
import authRoutes from './auth';
import musicRoutes from './music';
import reviewRoutesLegacy from './reviews'; // Original implementation
import statsRoutes from './stats';
import usersRoutes from './users';
import discoverRoutes from './discover';
import commentsRoutes from './comments';
import homeRoutes from './home';
import refreshRoutes from './refresh';
import scrobbleV2Routes from './scrobbleV2'; // V2: Server-assisted scrobbling

// V2 API routes (new minimal payload architecture)
import v2ScrobblesRoutes from './v2/scrobbles';

const router = Router();

// New grouped mounts (use refactored controller-based routes)
router.use('/user', userGroup);           // /api/user/* (grouped)
router.use('/spotify', spotifyGroup);     // /api/spotify/* (grouped)
router.use('/reviews', reviewsGroup);     // /api/reviews/* (grouped, NEW controller-based)
router.use('/stats', statsGroup);         // /api/stats/* (grouped)

// V2 API routes (hybrid normalization architecture)
router.use('/v2/scrobbles', v2ScrobblesRoutes); // /api/v2/scrobbles/* (hybrid storage)

// New production routes
router.use('/home', homeRoutes);          // /api/home/* (aggregated snapshot)
router.use('/refresh', refreshRoutes);    // /api/refresh/* (force refresh endpoints)
router.use('/scrobble', scrobbleV2Routes); // /api/scrobble/* (V2: server-assisted scrobbling)

// Legacy direct mounts (existing mobile app paths - keep old behavior)
router.use('/auth', authRoutes);
router.use('/music', musicRoutes);
// Legacy /api/reviews preserved for backward compatibility
// Note: grouped /api/reviews above now uses controller; this is fallback if needed
router.use('/stats', statsRoutes);
router.use('/users', usersRoutes);
router.use('/discover', discoverRoutes);
router.use('/comments', commentsRoutes);

export default router;
