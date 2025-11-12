import { Router, Request, Response } from 'express';
import { cache, CacheKeys, CacheTTL } from '../utils/cacheManager';
import { cachedSuccess, error } from '../utils/response';
import { spotifyClient } from '../utils/spotifyClient';
import User from '../models/User';
import Scrobble from '../models/Scrobble';
import AlbumStats from '../models/AlbumStats';
import TrackStats from '../models/TrackStats';
import UserStatsSummary from '../models/UserStatsSummary';

const router = Router();

/**
 * GET /api/home/snapshot
 * Aggregated home screen data - reduces mobile round-trips
 * 
 * Returns:
 * - User profile
 * - Recent scrobbles (last 10)
 * - Listening stats summary
 * - Top albums (top 5)
 * - Album progress (albums with >0% completion)
 * 
 * Cache: 30 seconds (balance freshness vs API load)
 * Force refresh: ?force=1
 */
router.get('/snapshot', async (req: Request, res: Response) => {
  try {
    const { userId, force } = req.query as { userId?: string; force?: string };

    if (!userId) {
      return error(res, 'userId required', 400);
    }

    const cacheKey = CacheKeys.userHomeSnapshot(userId);
    const shouldForce = force === '1' || force === 'true';

    // Check cache first (unless forced)
    if (!shouldForce) {
      const cached = cache.get<any>(cacheKey);
      if (cached) {
        console.log(`✅ Cache HIT: ${cacheKey}`);
        return cachedSuccess(res, cached.data, cached.metadata);
      }
    }

    console.log(`⚙️  Cache MISS: ${cacheKey} (${shouldForce ? 'forced' : 'expired'})`);

    // Fetch user profile
    const user = await User.findOne({
      $or: [{ _id: userId }, { spotifyId: userId }],
    }).select('_id spotifyId displayName email profileImage username tokenStatus').lean();

    if (!user) {
      return error(res, 'User not found', 404);
    }

    // Parallel fetch all data
    const [recentScrobblesRaw, albumStats, trackStats, userSummary] = await Promise.all([
      // Recent scrobbles (last 10) - HYBRID: Populate albumArt from albums collection
      Scrobble.find({ userId: user._id })
        .sort({ playedAt: -1 })
        .limit(10)
        .select('spotifyId trackName artistName albumName albumRefId playedAt durationMs')
        .populate('albumRefId', 'albumArt')
        .lean(),

      // Top albums (top 5)
      AlbumStats.find({ userId: user._id })
        .sort({ playCount: -1 })
        .limit(5)
        .select('albumKey albumName artistName albumArt playCount lastPlayedAt')
        .lean(),

      // Top tracks (top 5)
      TrackStats.find({ userId: user._id })
        .sort({ playCount: -1 })
        .limit(5)
        .select('trackKey trackName artistName albumName albumArt playCount lastPlayedAt')
        .lean(),

      // User stats summary
      UserStatsSummary.findOne({ userId: user._id }).lean(),
    ]);

    // HYBRID: Map albumArt from populated albumRefId
    const recentScrobbles = recentScrobblesRaw.map((item: any) => ({
      ...item,
      albumArt: (item.albumRefId as any)?.albumArt || undefined,
      albumRefId: undefined, // Remove populated object from response
    }));

    // Calculate album progress (albums with completion >0%)
    const albumProgress = albumStats
      .map((album) => {
        // Basic progress calculation (can be enhanced with actual track listening data)
        const progress = Math.min(100, Math.round((album.playCount / 10) * 100)); // Rough heuristic
        return {
          ...album,
          progress,
        };
      })
      .filter((a) => a.progress > 0);

    // Build aggregated response
    const snapshot = {
      user: {
        id: user._id,
        spotifyId: user.spotifyId,
        displayName: user.displayName,
        email: user.email,
        profileImage: user.profileImage,
        username: user.username,
        tokenStatus: user.tokenStatus,
      },
      recentActivity: {
        scrobbles: recentScrobbles,
        count: recentScrobbles.length,
      },
      stats: {
        totalScrobbles: userSummary?.totalScrobbles || 0,
        uniqueAlbums: albumStats.length,
        uniqueTracks: trackStats.length,
      },
      topContent: {
        albums: albumStats.slice(0, 5),
        tracks: trackStats.slice(0, 5),
      },
      albumProgress: albumProgress.slice(0, 10), // Top 10 in-progress albums
      meta: {
        lastUpdated: new Date().toISOString(),
        cacheStrategy: 'hybrid', // Data from both DB (scrobbles/stats) and Spotify (when needed)
      },
    };

    // Cache for 30 seconds
    cache.set(cacheKey, snapshot, CacheTTL.short, 'hybrid');

    return cachedSuccess(
      res,
      snapshot,
      {
        source: 'database',
        cachedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + CacheTTL.short * 1000).toISOString(),
        isFresh: true,
      }
    );
  } catch (err: any) {
    console.error('❌ Error fetching home snapshot:', err);
    return error(res, 'Failed to fetch home snapshot', 500, err.message);
  }
});

/**
 * GET /api/home/quick-stats
 * Ultra-fast stats endpoint for quick refreshes
 * Cache: 15 seconds
 */
router.get('/quick-stats', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query as { userId?: string };

    if (!userId) {
      return error(res, 'userId required', 400);
    }

    const cacheKey = `user:${userId}:quick-stats`;
    const cached = cache.get<any>(cacheKey);

    if (cached) {
      return cachedSuccess(res, cached.data, cached.metadata);
    }

    // Fetch only essential stats
    const [scrobbleCount, albumCount, trackCount] = await Promise.all([
      Scrobble.countDocuments({ userId }),
      AlbumStats.countDocuments({ userId }),
      TrackStats.countDocuments({ userId }),
    ]);

    const quickStats = {
      totalScrobbles: scrobbleCount,
      uniqueAlbums: albumCount,
      uniqueTracks: trackCount,
    };

    cache.set(cacheKey, quickStats, CacheTTL.veryShort, 'database');

    return cachedSuccess(
      res,
      quickStats,
      {
        source: 'database',
        cachedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + CacheTTL.veryShort * 1000).toISOString(),
        isFresh: true,
      }
    );
  } catch (err: any) {
    console.error('❌ Error fetching quick stats:', err);
    return error(res, 'Failed to fetch quick stats', 500, err.message);
  }
});

export default router;
