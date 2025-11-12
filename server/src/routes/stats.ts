import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { cache, CacheKeys, CacheTTL } from '../utils/cacheManager';
import { cachedSuccess, error, success } from '../utils/response';
import AlbumStats from '../models/AlbumStats';
import TrackStats from '../models/TrackStats';
import { parseUserId } from '../middleware/parseUserId';

const router = Router();

// Batch upsert album stats deltas from device
// Body: { albums: Array<{ albumId: string; albumName?: string; artistName?: string; albumArt?: string; deltaCount: number; lastPlayedAt?: string | number | Date; }> }
router.post('/album-batch-upsert', parseUserId, async (req: Request, res: Response) => {
  const userId = req.userId!; // Attached by parseUserId middleware
  const { albums } = req.body as {
    albums?: Array<{
      albumId: string;
      albumName?: string;
      artistName?: string;
      albumArt?: string;
      deltaCount: number;
      lastPlayedAt?: string | number | Date;
    }>;
  };

  if (!Array.isArray(albums)) {
    return error(res, 'albums[] required', 400);
  }

  try {
    const ops = albums
      .filter((a) => a && (a.albumId || a.albumName) && Number.isFinite(a.deltaCount))
      .map((a) => {
        const lastPlayedAt = a.lastPlayedAt ? new Date(a.lastPlayedAt) : undefined;
        const albumKey = a.albumId || a.albumName || '';
        return {
          updateOne: {
            filter: { userId, albumKey },
            update: {
              $setOnInsert: { userId, albumKey, albumId: a.albumId },
              $set: {
                albumName: a.albumName,
                artistName: a.artistName,
                albumArt: a.albumArt,
                ...(lastPlayedAt ? { lastPlayedAt } : {}),
              },
              $inc: { playCount: a.deltaCount },
            },
            upsert: true,
          },
        } as const;
      });

    if (!ops.length) {
      return success(res, { matched: 0, modified: 0, upserted: 0 });
    }

    const result = await AlbumStats.bulkWrite(ops, { ordered: false });
    const upserted = result.upsertedCount || 0;
    const modified = (result.modifiedCount || 0) + (result.matchedCount || 0) - upserted;
    const matched = result.matchedCount || 0;

    // Invalidate user's album stats cache after write
    cache.invalidate(CacheKeys.albumStats(userId.toString()));

    return success(res, { matched, modified, upserted });
  } catch (err: any) {
    console.error('Error upserting album stats:', err?.message || err);
    return error(res, 'Failed to upsert album stats', 500);
  }
});

// Get top albums for a user from cloud summary (V2: minimal projection + pagination)
router.get('/album/:userId', async (req: Request, res: Response) => {
  const { userId: userIdParam } = req.params as { userId: string };
  const { limit = '20', before, force, sort = 'playCount' } = req.query as { 
    limit?: string; 
    before?: string; 
    force?: string;
    sort?: 'playCount' | 'lastPlayedAt' | 'albumPlayCount';
  };

  if (!userIdParam) return error(res, 'userId required', 400);
  
  // Validate and convert userId from URL param to ObjectId
  if (!mongoose.Types.ObjectId.isValid(userIdParam)) {
    return error(res, 'Invalid userId format', 400);
  }
  const userId = new mongoose.Types.ObjectId(userIdParam);

  const parsedLimit = Math.min(Number(limit), 100); // Max 100 per request
  const sortField = sort === 'albumPlayCount' ? 'albumPlayCount' : sort === 'lastPlayedAt' ? 'lastPlayedAt' : 'playCount';

  try {
    const cacheKey = `${CacheKeys.albumStats(userId.toString())}-${sortField}-${parsedLimit}-${before || 'start'}`;
    const forceFetch = force === '1';

    // Check cache first (unless forced)
    if (!forceFetch) {
      const cached = cache.get<any[]>(cacheKey);
      if (cached) {
        return cachedSuccess(res, cached.data, cached.metadata);
      }
    }

    // Build query filter with cursor pagination
    const filter: any = { userId };
    if (before && mongoose.Types.ObjectId.isValid(before)) {
      filter._id = { $lt: new mongoose.Types.ObjectId(before) };
    }

    // Fetch from database with minimal projection
    const items = await AlbumStats.find(filter)
      .sort({ [sortField]: -1, _id: -1 })
      .limit(parsedLimit)
      .select('userId albumKey albumId albumName artistName albumArt totalTracks playCount albumPlayCount uniqueTracksPlayed lastPlayedAt lastCompletedAt')
      .lean();

    // Calculate progress percentage for each album
    const itemsWithProgress = items.map((item: any) => ({
      ...item,
      progressPercent: item.totalTracks >= 4 
        ? Math.round((item.uniqueTracksPlayed?.length || 0) / item.totalTracks * 100)
        : 0,
    }));

    // Cache for 30 seconds (frequently updated)
    cache.set(cacheKey, itemsWithProgress, CacheTTL.short, 'database');

    return cachedSuccess(res, itemsWithProgress, {
      source: forceFetch ? 'database' : 'database',
      cachedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + CacheTTL.short * 1000).toISOString(),
      isFresh: true,
      hasMore: items.length === parsedLimit,
      nextCursor: items.length === parsedLimit ? String(items[items.length - 1]._id) : null,
    });
  } catch (err: any) {
    console.error('Error fetching album stats:', err?.message || err);
    return error(res, 'Failed to fetch album stats', 500);
  }
});

export default router;
 
// ===== Track Stats (per-user per-track) =====

// Batch upsert track stats deltas from device
// Body: { tracks: Array<{ trackId?: string; trackName?: string; artistName?: string; albumName?: string; albumArt?: string; deltaCount: number; lastPlayedAt?: string | number | Date; }> }
router.post('/track-batch-upsert', parseUserId, async (req: Request, res: Response) => {
  const userId = req.userId!; // Attached by parseUserId middleware
  const { tracks } = req.body as {
    tracks?: Array<{
      trackId?: string;
      trackName?: string;
      artistName?: string;
      albumName?: string;
      albumArt?: string;
      deltaCount: number;
      lastPlayedAt?: string | number | Date;
    }>;
  };

  if (!Array.isArray(tracks)) {
    return error(res, 'tracks[] required', 400);
  }

  try {
    const ops = tracks
      .filter((t) => t && Number.isFinite(t.deltaCount) && (t.trackId || (t.trackName && t.artistName)))
      .map((t) => {
        const lastPlayedAt = t.lastPlayedAt ? new Date(t.lastPlayedAt) : undefined;
        const trackKey = t.trackId || `${t.trackName}|${t.artistName}`;
        return {
          updateOne: {
            filter: { userId, trackKey },
            update: {
              $setOnInsert: { userId, trackKey, trackId: t.trackId },
              $set: {
                trackName: t.trackName,
                artistName: t.artistName,
                albumName: t.albumName,
                albumArt: t.albumArt,
                ...(lastPlayedAt ? { lastPlayedAt } : {}),
              },
              $inc: { playCount: t.deltaCount },
            },
            upsert: true,
          },
        } as const;
      });

    if (!ops.length) {
      return success(res, { matched: 0, modified: 0, upserted: 0 });
    }

    const result = await TrackStats.bulkWrite(ops, { ordered: false });
    const upserted = result.upsertedCount || 0;
    const matched = result.matchedCount || 0;
    const modified = (result.modifiedCount || 0) + matched - upserted;

    // Invalidate user's track stats cache after write
    cache.invalidate(CacheKeys.trackStats(userId.toString()));

    return success(res, { matched, modified, upserted });
  } catch (err: any) {
    console.error('Error upserting track stats:', err?.message || err);
    return error(res, 'Failed to upsert track stats', 500);
  }
});

// Get top tracks for a user from cloud summary (V2: minimal projection + pagination)
router.get('/track/:userId', async (req: Request, res: Response) => {
  const { userId: userIdParam } = req.params as { userId: string };
  const { limit = '20', before, force, sort = 'playCount' } = req.query as { 
    limit?: string; 
    before?: string; 
    force?: string;
    sort?: 'playCount' | 'lastPlayedAt';
  };

  if (!userIdParam) return error(res, 'userId required', 400);
  
  // Validate and convert userId from URL param to ObjectId
  if (!mongoose.Types.ObjectId.isValid(userIdParam)) {
    return error(res, 'Invalid userId format', 400);
  }
  const userId = new mongoose.Types.ObjectId(userIdParam);

  const parsedLimit = Math.min(Number(limit), 100); // Max 100 per request
  const sortField = sort === 'lastPlayedAt' ? 'lastPlayedAt' : 'playCount';

  try {
    const cacheKey = `${CacheKeys.trackStats(userId.toString())}-${sortField}-${parsedLimit}-${before || 'start'}`;
    const forceFetch = force === '1';

    // Check cache first (unless forced)
    if (!forceFetch) {
      const cached = cache.get<any[]>(cacheKey);
      if (cached) {
        return cachedSuccess(res, cached.data, cached.metadata);
      }
    }

    // Build query filter with cursor pagination
    const filter: any = { userId };
    if (before && mongoose.Types.ObjectId.isValid(before)) {
      filter._id = { $lt: new mongoose.Types.ObjectId(before) };
    }

    // Fetch from database with minimal projection
    const items = await TrackStats.find(filter)
      .sort({ [sortField]: -1, _id: -1 })
      .limit(parsedLimit)
      .select('userId trackKey trackId trackName artistName albumName albumArt playCount lastPlayedAt replayGuardAt')
      .lean();

    // Cache for 30 seconds (frequently updated)
    cache.set(cacheKey, items, CacheTTL.short, 'database');

    return cachedSuccess(res, items, {
      source: forceFetch ? 'database' : 'database',
      cachedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + CacheTTL.short * 1000).toISOString(),
      isFresh: true,
      hasMore: items.length === parsedLimit,
      nextCursor: items.length === parsedLimit ? String(items[items.length - 1]._id) : null,
    });
  } catch (err: any) {
    console.error('Error fetching track stats:', err?.message || err);
    return error(res, 'Failed to fetch track stats', 500);
  }
});
