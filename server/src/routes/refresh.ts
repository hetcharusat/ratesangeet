import { Router, Request, Response } from 'express';
import { cache, CacheKeys } from '../utils/cacheManager.js';
import { cachedSuccess, error } from '../utils/response.js';
import { spotifyClient } from '../utils/spotifyClient.js';

const router = Router();

/**
 * POST /api/refresh/recent
 * Force refresh recently played tracks from Spotify
 * Bypasses cache and fetches fresh data
 */
router.post('/recent', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body as { userId?: string };

    if (!userId) {
      return error(res, 'userId required', 400);
    }

    console.log(`🔄 Force refresh: recent tracks for user ${userId}`);

    // Invalidate cache
    cache.invalidate(`user:${userId}:recent*`);

    // Fetch fresh from Spotify
    const result = await spotifyClient.getRecentlyPlayed(userId, 50);

    return cachedSuccess(
      res,
      result.data,
      {
        source: 'spotify',
        cachedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(), // Immediate expiry (fresh data)
        isFresh: true,
      },
      result.refreshedToken
    );
  } catch (err: any) {
    console.error('❌ Error refreshing recent tracks:', err);
    return error(res, 'Failed to refresh recent tracks', err.statusCode || 500, err.message);
  }
});

/**
 * POST /api/refresh/stats
 * Force recalculate user stats from scrobbles
 * Bypasses cache and recomputes from DB
 */
router.post('/stats', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body as { userId?: string };

    if (!userId) {
      return error(res, 'userId required', 400);
    }

    console.log(`🔄 Force refresh: stats for user ${userId}`);

    // Invalidate all stats caches for this user
    cache.invalidate(`user:${userId}:*stats*`);
    cache.invalidate(`user:${userId}:top-*`);

    return cachedSuccess(
      res,
      { message: 'Stats cache cleared. Next request will compute fresh stats.' },
      {
        source: 'database',
        cachedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        isFresh: true,
      }
    );
  } catch (err: any) {
    console.error('❌ Error refreshing stats:', err);
    return error(res, 'Failed to refresh stats', 500, err.message);
  }
});

/**
 * POST /api/refresh/discover
 * Clear discover feed cache
 */
router.post('/discover', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body as { userId?: string };

    if (!userId) {
      return error(res, 'userId required', 400);
    }

    console.log(`🔄 Force refresh: discover for user ${userId}`);

    const deleted = cache.invalidate(`discover:${userId}:*`);

    return cachedSuccess(
      res,
      { message: `Discover cache cleared (${deleted} entries). Next request will fetch fresh data.` },
      {
        source: 'cache',
        cachedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        isFresh: true,
      }
    );
  } catch (err: any) {
    console.error('❌ Error refreshing discover:', err);
    return error(res, 'Failed to refresh discover', 500, err.message);
  }
});

/**
 * POST /api/refresh/home
 * Clear home snapshot cache
 */
router.post('/home', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body as { userId?: string };

    if (!userId) {
      return error(res, 'userId required', 400);
    }

    console.log(`🔄 Force refresh: home snapshot for user ${userId}`);

    cache.delete(CacheKeys.userHomeSnapshot(userId));

    return cachedSuccess(
      res,
      { message: 'Home snapshot cache cleared. Next request will fetch fresh data.' },
      {
        source: 'cache',
        cachedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        isFresh: true,
      }
    );
  } catch (err: any) {
    console.error('❌ Error refreshing home:', err);
    return error(res, 'Failed to refresh home', 500, err.message);
  }
});

/**
 * POST /api/refresh/all
 * Nuclear option: clear ALL caches for a user
 */
router.post('/all', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body as { userId?: string };

    if (!userId) {
      return error(res, 'userId required', 400);
    }

    console.log(`🔄 NUCLEAR: clearing ALL caches for user ${userId}`);

    const deleted = cache.invalidateUser(userId);

    return cachedSuccess(
      res,
      { message: `All caches cleared for user (${deleted} entries). Fresh data will be fetched on next requests.` },
      {
        source: 'cache',
        cachedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        isFresh: true,
      }
    );
  } catch (err: any) {
    console.error('❌ Error clearing all caches:', err);
    return error(res, 'Failed to clear caches', 500, err.message);
  }
});

/**
 * GET /api/refresh/cache-stats
 * Get cache statistics (for debugging/monitoring)
 */
router.get('/cache-stats', async (req: Request, res: Response) => {
  try {
    const stats = cache.getStats();
    const keys = cache.getKeys();

    return cachedSuccess(
      res,
      {
        ...stats,
        sampleKeys: keys.slice(0, 20), // First 20 keys for inspection
      },
      {
        source: 'cache',
        cachedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        isFresh: true,
      }
    );
  } catch (err: any) {
    console.error('❌ Error fetching cache stats:', err);
    return error(res, 'Failed to fetch cache stats', 500, err.message);
  }
});

export default router;
