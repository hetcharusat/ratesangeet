import { Router } from 'express';
import userGroup from './groups/user.js';
import spotifyGroup from './groups/spotify.js';
import reviewsGroup from './groups/reviews.js';
import statsGroup from './groups/stats.js';

// Legacy routers (preserve existing paths for backward compatibility)
import authRoutes from './auth.js';
import musicRoutes from './music.js';
import reviewRoutesLegacy from './reviews.js'; // Original implementation
import statsRoutes from './stats.js';
import usersRoutes from './users.js';
import discoverRoutes from './discover.js';
import commentsRoutes from './comments.js';
import homeRoutes from './home.js';
import refreshRoutes from './refresh.js';
import scrobbleV2Routes from './scrobbleV2.js'; // V2: Server-assisted scrobbling

// V2 API routes (new minimal payload architecture)
import v2ScrobblesRoutes from './v2/scrobbles.js';

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
