import { Router } from 'express';
import { Request, Response } from 'express';
import Scrobble from '../../models/Scrobble.js';
import TrackStats from '../../models/TrackStats.js';
import AlbumStats from '../../models/AlbumStats.js';
import UserStatsSummary from '../../models/UserStatsSummary.js';
import { requireAuth } from '../../middleware/auth.js';
import { HybridNormalizationService } from '../../services/HybridNormalizationService.js';
import axios from 'axios';

const router = Router();

// Scrobble threshold constant
const SCROBBLE_THRESHOLD = 0.4; // 40%
const MIN_DURATION_MS = 30000; // 30 seconds
const REPLAY_GUARD_MINUTES = 15;

// In-memory cache for album totalTracks (simple Map, TTL 1 hour)
const albumCache = new Map<string, { totalTracks: number; cachedAt: number }>();
const ALBUM_CACHE_TTL = 3600000; // 1 hour

/**
 * POST /api/v2/scrobbles/batch-upsert
 * 
 * Client-side batch sync endpoint. Accepts up to 100 scrobbles.
 * Logic:
 * 1. Validate each item: progressMs/durationMs >= 40% OR progressMs >= 30s → isScrobbled
 * 2. Calculate playedAtRounded10s = floor((playedAt - progressMs) / 10000) * 10000
 * 3. Upsert scrobbles_recent by (userId, spotifyId, playedAtRounded10s)
 * 4. If isScrobbled:
 *    - Upsert trackstats: increment playCount if last play >15min ago; always update lastPlayedAt
 *    - Fetch album totalTracks (cached); skip if <4 tracks
 *    - Upsert albumstats: increment playCount, add to uniqueTracksPlayed, check 70% completion
 *    - Increment userstatssummaries.totalScrobbles
 */
router.post('/batch-upsert', requireAuth, async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    const userId = (req as any).authUser._id; // Attached by requireAuth middleware
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array required' });
    }
    
    if (items.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 items per batch' });
    }
    
    let processed = 0;
    let scrobbled = 0;
    let duplicates = 0;
    const errors: any[] = [];
    
    for (const item of items) {
      try {
        const {
          spotifyId,
          trackName,
          artistName,
          albumId,
          albumName,
          durationMs,
          progressMs,
          playedAt,
          source = 'spotify',
          device,
          clientVersion,
        } = item;
        
        if (!spotifyId || !trackName || !artistName || !durationMs || progressMs === undefined) {
          errors.push({ item, error: 'Missing required fields' });
          continue;
        }
        
        // 1. Determine if scrobbled: >=40% OR >=30s
        const isScrobbled = 
          (progressMs / durationMs >= SCROBBLE_THRESHOLD) || 
          (progressMs >= MIN_DURATION_MS);
        
        // 2. Calculate playedAtRounded10s for stable dedup
        const playedAtDate = new Date(playedAt || Date.now());
        const startedAtMs = playedAtDate.getTime() - progressMs;
        const roundedStartMs = Math.floor(startedAtMs / 10000) * 10000;
        const playedAtRounded10s = new Date(roundedStartMs);
        
        // 2b. HYBRID: Create/find normalized entities (Track, Album, Artist)
        let trackId, albumRefId, artistId;
        if (albumId && isScrobbled) {
          try {
            const normalized = await HybridNormalizationService.normalizeScrobbleData({
              spotifyId,
              trackName,
              artistName,
              albumSpotifyId: albumId,
              albumName: albumName || 'Unknown Album',
              albumArt: item.albumArt,
              durationMs,
            });
            trackId = normalized.trackId;
            albumRefId = normalized.albumId;
            artistId = normalized.artistId;
          } catch (err: any) {
            console.warn('[HYBRID] Failed to normalize:', err.message);
          }
        }
        
        // 3. Upsert scrobbles_recent
        const scrobble = await Scrobble.findOneAndUpdate(
          { 
            userId, 
            spotifyId, 
            playedAtRounded10s 
          },
          {
            $setOnInsert: {
              userId,
              spotifyId,
              playedAtRounded10s,
              playedAt: playedAtDate,
              source,
            },
            $set: {
              trackName,
              artistName,
              albumId,
              albumName,
              durationMs,
              device,
              clientVersion,
              isScrobbled,
              isSkip: item.isSkip,
              isPaused: item.isPaused,
              // Hybrid references
              ...(trackId && { trackId }),
              ...(albumRefId && { albumRefId }),
              ...(artistId && { artistId }),
            },
          },
          { upsert: true, new: true }
        );
        
        processed++;
        
        if (!scrobble.isNew) {
          duplicates++;
        }
        
        // 4. If scrobbled, update stats
        if (isScrobbled) {
          scrobbled++;
          
          // 4a. Update trackstats
          const trackKey = spotifyId || `${artistName}::${trackName}`;
          const now = new Date();
          
          const trackStats = await TrackStats.findOne({ 
            userId, 
            trackKey 
          }).select('lastPlayedAt').lean();
          
          const shouldIncrementPlay = 
            !trackStats?.lastPlayedAt || 
            (now.getTime() - new Date(trackStats.lastPlayedAt).getTime() > REPLAY_GUARD_MINUTES * 60 * 1000);
          
          await TrackStats.findOneAndUpdate(
            { userId, trackKey },
            {
              $setOnInsert: {
                userId,
                trackKey,
                trackId: spotifyId,
                playCount: 0,
              },
              $set: {
                trackName,
                artistName,
                albumName,
                lastPlayedAt: playedAtDate,
                replayGuardAt: shouldIncrementPlay ? playedAtDate : undefined,
              },
              ...(shouldIncrementPlay && { $inc: { playCount: 1 } }),
            },
            { upsert: true }
          );
          
          // 4b. Update albumstats (only if albumId exists and ≥4 tracks)
          if (albumId) {
            const albumKey = albumId || albumName || 'Unknown Album';
            
            // Fetch totalTracks (cached)
            let totalTracks = await getAlbumTotalTracks(albumId);
            
            // Skip albums with <4 tracks
            if (totalTracks && totalTracks >= 4) {
              const albumStats = await AlbumStats.findOneAndUpdate(
                { userId, albumKey },
                {
                  $setOnInsert: {
                    userId,
                    albumKey,
                    albumId,
                    totalTracks,
                    albumPlayCount: 0,
                    uniqueTracksPlayed: [],
                  },
                  $set: {
                    albumName,
                    artistName,
                    lastPlayedAt: playedAtDate,
                  },
                  $inc: { playCount: 1 },
                },
                { upsert: true, new: true }
              );
              
              // Add track to uniqueTracksPlayed if not already there
              if (!albumStats.uniqueTracksPlayed.includes(spotifyId)) {
                albumStats.uniqueTracksPlayed.push(spotifyId);
                
                // Check if 70% completion reached
                const progress = albumStats.uniqueTracksPlayed.length / (albumStats.totalTracks || 1);
                
                if (progress >= 0.7) {
                  // Completion! Increment albumPlayCount and reset cycle
                  albumStats.albumPlayCount += 1;
                  albumStats.lastCompletedAt = playedAtDate;
                  albumStats.uniqueTracksPlayed = [];
                }
                
                await albumStats.save();
              }
            }
          }
          
          // 4c. Increment userstatssummaries
          await UserStatsSummary.findOneAndUpdate(
            { userId },
            {
              $inc: { totalScrobbles: 1 },
              $set: {
                'lastScrobbled.spotifyId': spotifyId,
                'lastScrobbled.trackName': trackName,
                'lastScrobbled.artistName': artistName,
                'lastScrobbled.albumName': albumName,
                'lastScrobbled.playedAt': playedAtDate,
              },
            },
            { upsert: true }
          );
        }
      } catch (err: any) {
        errors.push({ item, error: err.message });
      }
    }
    
    res.json({
      ok: true,
      processed,
      scrobbled,
      duplicates,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('[v2/scrobbles/batch-upsert] Error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

/**
 * GET /api/v2/scrobbles/recent
 * 
 * Returns recent scrobbles with pagination.
 * Query params: limit (default 20, max 100), before (ISO date), include (e.g., 'skips')
 */
router.get('/recent', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).authUser._id; // Attached by requireAuth middleware
    
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const before = req.query.before ? new Date(req.query.before as string) : new Date();
    const includeSkips = req.query.include === 'skips';
    
    const query: any = {
      userId,
      playedAt: { $lt: before },
    };
    
    if (!includeSkips) {
      query.isSkip = { $ne: true };
    }
    
    const items = await Scrobble.find(query)
      .select('spotifyId trackName artistName albumId albumName albumRefId durationMs playedAt source isScrobbled isSkip isPaused')
      .populate('albumRefId', 'albumArt') // HYBRID: Fetch albumArt from albums collection
      .sort({ playedAt: -1 })
      .limit(limit)
      .lean();
    
    // Map albumArt from populated albumRefId
    const mappedItems = items.map(item => ({
      ...item,
      albumArt: (item.albumRefId as any)?.albumArt || undefined,
      albumRefId: undefined, // Remove the reference object from response
    }));
    
    const nextBefore = items.length > 0 ? items[items.length - 1].playedAt : null;
    
    res.json({
      items: mappedItems,
      nextBefore: nextBefore ? nextBefore.toISOString() : null,
    });
  } catch (error: any) {
    console.error('[v2/scrobbles/recent] Error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

/**
 * GET /api/v2/scrobbles/archive-ready
 * 
 * Returns scrobbles eligible for device archive (older than 83 days).
 * Query params: before (optional, default now-83d), limit (default 500, max 1000)
 */
router.get('/archive-ready', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).authUser._id; // Attached by requireAuth middleware
    
    const GRACE_DAYS = 7;
    const TTL_DAYS = Number(process.env.SCROBBLES_TTL_DAYS) || 90;
    const cutoffDays = TTL_DAYS - GRACE_DAYS;
    
    const limit = Math.min(Number(req.query.limit) || 500, 1000);
    const before = req.query.before 
      ? new Date(req.query.before as string)
      : new Date(Date.now() - cutoffDays * 24 * 60 * 60 * 1000);
    
    const items = await Scrobble.find({
      userId,
      playedAt: { $lt: before },
    })
      .select('_id spotifyId trackName artistName albumId albumName durationMs playedAt source isScrobbled isSkip isPaused')
      .sort({ playedAt: 1 })
      .limit(limit)
      .lean();
    
    const nextBefore = items.length > 0 ? items[items.length - 1].playedAt : null;
    
    res.json({
      items,
      nextBefore: nextBefore ? nextBefore.toISOString() : null,
    });
  } catch (error: any) {
    console.error('[v2/scrobbles/archive-ready] Error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

/**
 * POST /api/v2/scrobbles/ack-archive
 * 
 * Deletes scrobbles after device has archived them locally.
 * Body: { ids: string[] }
 */
router.post('/ack-archive', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).authUser._id; // Attached by requireAuth middleware
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'ids array required' });
    }
    
    const result = await Scrobble.deleteMany({
      _id: { $in: ids },
      userId,
    });
    
    res.json({
      ok: true,
      deleted: result.deletedCount,
    });
  } catch (error: any) {
    console.error('[v2/scrobbles/ack-archive] Error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

/**
 * Helper: Get album totalTracks from Spotify (with cache)
 */
async function getAlbumTotalTracks(albumId: string): Promise<number | null> {
  const cached = albumCache.get(albumId);
  if (cached && Date.now() - cached.cachedAt < ALBUM_CACHE_TTL) {
    return cached.totalTracks;
  }
  
  try {
    // TODO: Use proper Spotify API client with token management
    // For now, return null and let caller skip album logic
    // This will be implemented in SpotifyService
    return null;
  } catch (error) {
    return null;
  }
}

export default router;
