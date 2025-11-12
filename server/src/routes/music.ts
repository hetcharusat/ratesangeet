import { Router, Request, Response } from 'express';
import axios from 'axios';
import mongoose from 'mongoose';
import crypto from 'crypto';
import Scrobble from '../models/Scrobble';
import UserStatsSummary from '../models/UserStatsSummary';
import AlbumStats from '../models/AlbumStats';
import TrackStats from '../models/TrackStats';
import CompletionEvent from '../models/CompletionEvent';
import User from '../models/User';
import { spotifyClient } from '../utils/spotifyClient';
import { cache, CacheKeys, CacheTTL } from '../utils/cacheManager';
import { error as respondError, transitionalSuccess } from '../utils/response';
import { batchUpsertRateLimiter } from '../middleware/optimization';
import { parseUserId } from '../middleware/parseUserId';
import { HybridNormalizationService } from '../services/HybridNormalizationService';

const router = Router();

const CLOUD_ENABLE_SCROBBLES = (process.env.CLOUD_ENABLE_SCROBBLES ?? 'true') !== 'false';
const CLOUD_SCROBBLE_RETENTION_DAYS = Number(process.env.CLOUD_SCROBBLE_RETENTION_DAYS) || 30;
const SKIP_DETECTION_ENABLED = process.env.BACKGROUND_SCROBBLE_SKIP_DETECTION !== 'false'; // Enable by default

// Skip detection constants (same as backgroundScrobbler)
const SCROBBLE_THRESHOLD = 0.4;
const GRACE_MARGIN_MS = 5000;
const PAUSE_DETECTION_MULTIPLIER = 1.5;
const MAX_RECENT_TRACK_AGE_MS = 120000;

// In-memory cache for listening stats.
// Improved strategy:
// 1. Very short TTL (15s) to keep UI feeling live.
// 2. Force bypass with ?force=1
// 3. Automatic bust if a newer scrobble exists (playedAt newer than cached.lastScrobblePlayedAt)
// 4. Expose cache metadata for client side debugging.
interface StatsCacheEntry { data: any; timestamp: number; lastScrobblePlayedAt?: number }
const statsCache = new Map<string, StatsCacheEntry>();
const STATS_CACHE_TTL = 15 * 1000; // 15 seconds

// Get Recently Played Tracks
router.get('/recent', async (req: Request, res: Response) => {
  const { accessToken } = req.query;

  if (!accessToken) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const response = await axios.get(
      'https://api.spotify.com/v1/me/player/recently-played?limit=50',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('Error fetching recent tracks:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch recent tracks' 
    });
  }
});

// Get Top Tracks
router.get('/top-tracks', async (req: Request, res: Response) => {
  const { accessToken, timeRange = 'medium_term' } = req.query;

  if (!accessToken) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=50`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('Error fetching top tracks:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch top tracks' 
    });
  }
});

// Search Music - Returns albums first, then tracks
router.get('/search', async (req: Request, res: Response) => {
  const { q, type = 'track,album', userId, accessToken, force } = req.query as { q?: string; type?: string; userId?: string; accessToken?: string; force?: string };
  if (!q) {
    return res.status(400).json({ error: 'q (query) required' });
  }
  // Build cache key – differentiate anonymous vs user-based for isolation
  const cacheKeyBase = userId ? CacheKeys.spotifySearch(q.toLowerCase(), type) : `spotify:search:anon:${type}:${q.toLowerCase()}`;
  try {
    const forceFetch = force === '1' || force === 'true';
    if (!forceFetch) {
      const cached = cache.get<any>(cacheKeyBase);
      if (cached) {
        return transitionalSuccess(res, cached.data, { cache: cached.metadata });
      }
    }
    const types = type.split(',');
    const result: any = {};
    if (userId) {
      // Preferred path: userId enables token refresh logic
      for (const t of types) {
        if (!['track','album','artist'].includes(t)) continue;
        const api = await spotifyClient.search(q, t as any, userId, 20);
        if (api.refreshedToken) result.refreshedToken = api.refreshedToken;
        if (t === 'track') result.tracks = api.data.tracks;
        if (t === 'album') result.albums = api.data.albums;
        if (t === 'artist') result.artists = (api.data as any).artists;
      }
    } else if (accessToken) {
      // Anonymous fallback: use raw access token without refresh
      for (const t of types) {
        if (!['track','album','artist'].includes(t)) continue;
        try {
          const resp = await axios.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=${t}&limit=20`, {
            headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10000,
          });
          const data = resp.data;
          if (t === 'track') result.tracks = data.tracks;
          if (t === 'album') result.albums = data.albums;
          if (t === 'artist') result.artists = data.artists;
        } catch (e: any) {
          console.warn(`[SEARCH] Fallback search failed for type=${t}:`, e.response?.status || e.message);
        }
      }
    } else {
      return res.status(400).json({ error: 'Either userId or accessToken required' });
    }
  cache.set(cacheKeyBase, result, CacheTTL.long, 'spotify');
  return transitionalSuccess(res, result, { cache: { source: 'spotify', cachedAt: new Date().toISOString(), expiresAt: new Date(Date.now()+CacheTTL.long*1000).toISOString(), isFresh: true }, refreshedToken: (result as any).refreshedToken });
  } catch (err: any) {
    console.error('[SEARCH] Error:', err.message);
    respondError(res, err.message || 'Search failed', err.statusCode || 500);
  }
});

// Artist profile: top tracks + discography (albums/singles/compilations)
router.get('/artist', async (req: Request, res: Response) => {
  const { accessToken, q, artistId, market = 'US' } = req.query as any;
  if (!accessToken) return res.status(401).json({ error: 'Access token required' });
  try {
    let id = artistId as string | undefined;
    let artist: any = null;
    if (!id) {
      if (!q) return res.status(400).json({ error: 'artistId or q is required' });
      const searchResp = await axios.get(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(q as string)}&type=artist&limit=1`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const found = searchResp.data?.artists?.items?.[0];
      if (!found) return res.json({ artist: null, topTracks: [], discography: { albums: [], singles: [], compilations: [] } });
      id = found.id;
      artist = found;
    } else {
      const artResp = await axios.get(
        `https://api.spotify.com/v1/artists/${id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      artist = artResp.data;
    }

    // Top tracks
    const topResp = await axios.get(
      `https://api.spotify.com/v1/artists/${id}/top-tracks?market=${market}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const topTracks = (topResp.data?.tracks || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      duration_ms: t.duration_ms,
      popularity: t.popularity,
      preview_url: t.preview_url,
      album: {
        id: t.album?.id,
        name: t.album?.name,
        images: t.album?.images || [],
      },
      artists: (t.artists || []).map((a: any) => ({ id: a.id, name: a.name })),
    }));

    // Discography
    const albumsResp = await axios.get(
      `https://api.spotify.com/v1/artists/${id}/albums?include_groups=album,single,compilation&market=${market}&limit=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const items: any[] = albumsResp.data?.items || [];
    const byGroup = { albums: [] as any[], singles: [] as any[], compilations: [] as any[] };
    const seen = new Set<string>();
    for (const it of items) {
      // Dedupe by album name + release date
      const key = `${it.name}|${it.release_date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const entry = {
        id: it.id,
        name: it.name,
        album_group: it.album_group || it.album_type,
        release_date: it.release_date,
        images: it.images || [],
      };
      const grp = (it.album_group || it.album_type || '').toLowerCase();
      if (grp.includes('single')) byGroup.singles.push(entry);
      else if (grp.includes('compilation')) byGroup.compilations.push(entry);
      else byGroup.albums.push(entry);
    }

    res.json({ artist, topTracks, discography: byGroup });
  } catch (error: any) {
    console.error('Error fetching artist:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: 'Failed to fetch artist' });
  }
});

// Get album details including track list
router.get('/album', async (req: Request, res: Response) => {
  const { accessToken, albumId } = req.query;

  if (!accessToken || !albumId) {
    return res.status(400).json({ error: 'Access token and albumId required' });
  }

  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/albums/${albumId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    // Avoid flooding logs for routine 401s when an expired token hits many albums in a batch
    const status = error?.response?.status;
    if (status !== 401) {
      console.error('Error fetching album details:', error.response?.data || error.message);
    }
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch album details',
    });
  }
});

// Get currently playing track (for scrobbling)
router.get('/currently-playing', async (req: Request, res: Response) => {
  const { userId, accessToken } = req.query as { userId?: string; accessToken?: string };
  if (!userId && !accessToken) return res.status(400).json({ error: 'userId or accessToken required' });
  try {
    if (userId) {
      const api = await spotifyClient.getCurrentlyPlaying(userId);
      const cp = api.data;
      if (!cp || !cp.item) return transitionalSuccess(res, { isPlaying: false });
      const result: any = {
        isPlaying: cp.is_playing,
        track: cp.item,
        progressMs: cp.progress_ms,
        timestamp: cp.timestamp,
      };
      return transitionalSuccess(res, result, { refreshedToken: api.refreshedToken });
    }
    // Fallback anonymous access
    const resp = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${accessToken}` }, timeout: 8000,
    });
    if (resp.status === 204 || !resp.data) return transitionalSuccess(res, { isPlaying: false });
    return transitionalSuccess(res, {
      isPlaying: resp.data.is_playing,
      track: resp.data.item,
      progressMs: resp.data.progress_ms,
      timestamp: resp.data.timestamp,
    });
  } catch (err: any) {
    console.error('[CURRENTLY PLAYING] Error:', err.message);
    const status = err.statusCode || err.response?.status || 500;
    res.status(status).json({ error: err.message || 'Failed to fetch currently playing track' });
  }
});

// Get recently played tracks (for auto-scrobbling)
router.get('/recently-played', async (req: Request, res: Response) => {
  const { userId, accessToken, limit = 50, force } = req.query as { userId?: string; accessToken?: string; limit?: string | number; force?: string };
  if (!userId && !accessToken) return res.status(400).json({ error: 'userId or accessToken required' });
  const lim = Number(limit) || 50;
  try {
    const cacheKey = userId ? CacheKeys.userRecentTracks(userId) : 'user:anon:recent';
    const forceFetch = force === '1' || force === 'true';
    if (!forceFetch) {
      const cached = cache.get<any>(cacheKey);
      if (cached) {
        return transitionalSuccess(res, cached.data, { cache: cached.metadata });
      }
    }
    let items: any[] = [];
    let refreshedToken: string | undefined;
    if (userId) {
      const api = await spotifyClient.getRecentlyPlayed(userId, lim);
      items = api.data?.items || [];
      refreshedToken = api.refreshedToken;
    } else if (accessToken) {
      try {
        const resp = await axios.get(`https://api.spotify.com/v1/me/player/recently-played?limit=${lim}`, {
          headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10000,
        });
        items = resp.data?.items || [];
      } catch (e: any) {
        console.error('[RECENTLY PLAYED] Fallback error:', e.response?.status || e.message);
      }
    }
  const result = { items };
  cache.set(cacheKey, result, CacheTTL.short, 'spotify');
  return transitionalSuccess(res, result, { cache: { source: 'spotify', cachedAt: new Date().toISOString(), expiresAt: new Date(Date.now()+CacheTTL.short*1000).toISOString(), isFresh: true }, refreshedToken });
  } catch (err: any) {
    console.error('[RECENTLY PLAYED] Error:', err.message);
    const status = err.statusCode || err.response?.status || 500;
    res.status(status).json({ error: 'Failed to fetch recently played tracks', message: err.message });
  }
});

// Create a scrobble entry based on the user's currently playing track
router.post('/scrobble', parseUserId, async (req: Request, res: Response) => {
  const { accessToken } = req.body;
  const userId = req.userId!; // Already validated by parseUserId middleware

  if (!accessToken) {
    return res.status(400).json({ error: 'Access token required' });
  }

  // ROOT FIX: Ensure user exists BEFORE allowing scrobble so we never end up with
  // scrobbles referencing a missing user document. If it's missing, attempt to
  // reconstruct minimal User from Spotify /me. If that fails, instruct client to re-auth.
  try {
    let userDoc = await User.findById(userId).select('_id spotifyId displayName username');
    if (!userDoc) {
      // Attempt recovery using Spotify profile
      try {
        const meResp = await axios.get('https://api.spotify.com/v1/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const sp = meResp.data;
        // Generate username if needed
        const base = (sp.display_name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'user';
        let candidate = base; let suffix = 0;
        while (await User.findOne({ username: candidate })) { suffix++; candidate = `${base}${suffix}`; }
        userDoc = await User.create({
          _id: userId, // preserve existing scrobble references
          spotifyId: sp.id,
          displayName: sp.display_name,
          email: sp.email || 'unknown@example.com',
          accessToken,
          refreshToken: '',
          profileImage: sp.images?.[0]?.url,
          username: candidate,
        });
        console.log('[SCROBBLE] ✅ Auto-created missing user before scrobble', userId);
      } catch (e: any) {
        console.error('[SCROBBLE] ❌ Failed auto-create user', e.response?.data || e.message);
        return res.status(409).json({ error: 'User missing and could not be recovered. Please re-login.' });
      }
    }
  } catch (userCheckErr: any) {
    return res.status(500).json({ error: 'User validation failed', details: userCheckErr.message });
  }

  try {
    const response = await axios.get(
      'https://api.spotify.com/v1/me/player/currently-playing',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (response.status === 204 || !response.data?.item) {
      return transitionalSuccess(res, { scrobbled: false, message: 'Nothing currently playing' });
    }

    const { item, is_playing, progress_ms, timestamp } = response.data;

    if (!is_playing || !item) {
      return transitionalSuccess(res, { scrobbled: false, message: 'Playback is paused' });
    }

    const progressMs = progress_ms ?? 0;
    const durationMs = item.duration_ms ?? 0;
    const minProgressForScrobble = durationMs * 0.4; // 40% threshold (aligned with client)
    
    // Only scrobble if track is played 40% or more
    if (progressMs < minProgressForScrobble || durationMs === 0) {
      return transitionalSuccess(res, { scrobbled: false, message: 'Minimum play time not reached (40%)' });
    }

    // ROOT FIX: Round timestamp to prevent duplicates
    // Calculate when track started playing
    const startedAtMs = (timestamp ?? Date.now()) - progressMs;
    // Round to nearest 10 seconds to group rapid re-polls of same track
    // This ensures the SAME rounded timestamp is used for deduplication
    const roundedStartMs = Math.floor(startedAtMs / 10000) * 10000;
    const playedAt = new Date(roundedStartMs);

    const trackName = item.name;
    const artistName = (item.artists || []).map((artist: any) => artist.name).join(', ');
    const albumName = item.album?.name;
    const albumArt = item.album?.images?.[0]?.url;

    if (!CLOUD_ENABLE_SCROBBLES) {
      // Do not persist to cloud; update minimal summary and return a thin scrobble object
      try {
        await UserStatsSummary.findOneAndUpdate(
          { userId },
          {
            $set: {
              lastScrobbled: {
                spotifyId: item.id,
                trackName,
                artistName,
                albumName,
                playedAt,
              },
            },
            $inc: { totalScrobbles: 1 },
          },
          { upsert: true }
        );
      } catch {}

      return transitionalSuccess(res, {
        scrobbled: true,
        scrobble: {
          _id: 'local-only',
          userId,
          spotifyId: item.id,
          trackName,
          artistName,
          albumName,
          albumArt,
          durationMs,
          playedAt: playedAt.toISOString(),
          source: 'spotify',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    }

    // HYBRID: Create/find normalized entities (Track, Album, Artist)
    let trackId, albumRefId, artistId;
    if (item.album?.id) {
      try {
        const normalized = await HybridNormalizationService.normalizeScrobbleData({
          spotifyId: item.id,
          trackName,
          artistName,
          albumSpotifyId: item.album.id,
          albumName: albumName || 'Unknown Album',
          albumArt,
          durationMs,
        });
        trackId = normalized.trackId;
        albumRefId = normalized.albumId;
        artistId = normalized.artistId;
      } catch (err: any) {
        console.warn('[SCROBBLE][HYBRID] Failed to normalize:', err.message);
      }
    }

    const scrobble = await Scrobble.findOneAndUpdate(
      { 
        userId, 
        spotifyId: item.id, 
        playedAt // Exact match on rounded timestamp (works with unique index)
      },
      {
        $setOnInsert: {
          userId,
          spotifyId: item.id,
          playedAt,
          source: 'spotify',
        },
        $set: {
          trackName,
          artistName,
          albumId: item.album?.id,
          albumName,
          albumArt,
          durationMs,
          // Hybrid references
          ...(trackId && { trackId }),
          ...(albumRefId && { albumRefId }),
          ...(artistId && { artistId }),
        },
      },
      { upsert: true, new: true }
    );

    // Update AlbumStats: playCount and completion metrics
    try {
      const albumId: string | undefined = item.album?.id;
      const albumNameSafe: string = albumName || 'Unknown Album';
      const albumKey: string = albumId || albumNameSafe;

      // Fetch totalTracks FIRST (V2 Contract: only track albums with ≥4 tracks)
      let totalTracks: number | undefined = undefined;
      if (albumId) {
        try {
          const albumResp = await axios.get(`https://api.spotify.com/v1/albums/${albumId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          totalTracks = albumResp.data?.total_tracks || albumResp.data?.tracks?.total || 0;
        } catch {}
      }

      // Skip albums with <4 tracks (singles/EPs)
      if (!totalTracks || totalTracks < 4) {
        // Don't create AlbumStats for singles/EPs
        console.log(`[SCROBBLE] Skipping album ${albumNameSafe} (totalTracks: ${totalTracks})`);
      } else {
        // 1) Upsert base stats and increment playCount
        const stats = await AlbumStats.findOneAndUpdate(
          { userId, albumKey },
          {
            $setOnInsert: {
              albumId,
              albumKey,
              albumName: albumNameSafe,
              artistName,
              albumArt,
              totalTracks, // Set totalTracks on creation
              albumPlayCount: 0,
              uniqueTracksPlayed: [], // Initialize empty array
            },
            $set: { lastPlayedAt: playedAt, albumArt, artistName, albumName: albumNameSafe },
            $inc: { playCount: 1 },
          },
          { upsert: true, new: true }
        );

        // 2) Update per-cycle progress to count multiple full plays.
        if (totalTracks && totalTracks > 0) {
          // Reload fresh snapshot to get uniqueTracksPlayed
          const fresh = await AlbumStats.findById(stats._id).select('uniqueTracksPlayed albumPlayCount').lean();
          const seen: string[] = Array.isArray(fresh?.uniqueTracksPlayed) ? fresh!.uniqueTracksPlayed : [];
          const already = seen.includes(item.id);
          if (!already) {
            seen.push(item.id);
          }
          if (seen.length >= totalTracks) {
            // Completion achieved for this cycle
            await AlbumStats.updateOne(
              { _id: stats._id },
              {
                $inc: { albumPlayCount: 1 },
                $set: { lastCompletedAt: playedAt, uniqueTracksPlayed: [] },
              }
            );
            // Emit a completion event for time-series analytics
            try {
              await CompletionEvent.create({
                userId,
                albumId,
                albumKey,
                albumName: albumNameSafe,
                artistName,
                albumArt,
                completedAt: playedAt,
              });
            } catch {}
          } else if (!already) {
            // Persist partial progress for the current cycle
            await AlbumStats.updateOne(
              { _id: stats._id },
              { $set: { uniqueTracksPlayed: seen } }
            );
          }
        }
      } // Close else block for albums with >=4 tracks
    } catch (e) {
      console.warn('[SCROBBLE] AlbumStats update skipped:', (e as any)?.message || e);
    }

  return transitionalSuccess(res, { scrobbled: true, scrobble });
  } catch (error: any) {
    console.error('Error scrobbling track:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to scrobble track',
    });
  }
});

// Test route to verify new routes register
router.get('/test-v2', (_req: Request, res: Response) => {
  res.json({ ok: true, message: 'V2 routes working!' });
});

// =====================================================================
// V2: Batch Upsert Scrobbles (Client-Side Detection, 40% Threshold)
// Rate limit: 100 requests/min
// =====================================================================
router.post('/scrobbles/batch-upsert', batchUpsertRateLimiter, async (req: Request, res: Response) => {
  console.log('[BATCH UPSERT] Request received:', { userId: req.body.userId, itemsCount: req.body.items?.length });
  const { userId, accessToken, items } = req.body;

  if (!userId || !accessToken || !Array.isArray(items)) {
    return res.status(400).json({ error: 'userId, accessToken, and items[] required' });
  }

  if (items.length > 100) {
    return res.status(400).json({ error: 'Max 100 items per batch' });
  }

  // Validate userId format
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ error: 'Invalid userId format' });
  }

  // Import SpotifyService
  const { spotifyService } = await import('../services/SpotifyService.js');

  const results = {
    ok: true,
    processed: 0,
    scrobbled: 0,
    skipped: 0,
    duplicates: 0,
    errors: [] as string[],
  };

  try {
    for (const item of items) {
      try {
        results.processed++;

        const {
          spotifyId,
          trackName,
          artistName,
          albumId,
          albumName,
          albumArt,
          durationMs,
          progressMs,
          timestamp,
          device,
          clientVersion,
        } = item;

        // Validate required fields
        if (!spotifyId || !trackName || !artistName || durationMs === undefined || progressMs === undefined) {
          results.errors.push(`Missing required fields for item ${results.processed}`);
          continue;
        }

        // Calculate isScrobbled (40% threshold OR >= 30s)
        const isScrobbled = (progressMs / durationMs >= 0.4) || (progressMs >= 30000);

        // Calculate playedAtRounded10s (stable dedup key)
        const startedAtMs = (timestamp || Date.now()) - progressMs;
        const roundedStartMs = Math.floor(startedAtMs / 10000) * 10000;
        const playedAt = new Date(roundedStartMs);
        const playedAtRounded10s = new Date(roundedStartMs);

        // HYBRID: Create/find normalized entities (Track, Album, Artist)
        let trackId, albumRefId, artistId;
        if (albumId && isScrobbled) {
          try {
            const normalized = await HybridNormalizationService.normalizeScrobbleData({
              spotifyId,
              trackName,
              artistName,
              albumSpotifyId: albumId,
              albumName: albumName || 'Unknown Album',
              albumArt,
              durationMs,
            });
            trackId = normalized.trackId;
            albumRefId = normalized.albumId;
            artistId = normalized.artistId;
          } catch (err: any) {
            console.warn('[BATCH UPSERT][HYBRID] Failed to normalize:', err.message);
          }
        }

        // Upsert scrobbles_recent (TTL 90d)
        const scrobbleDoc = await Scrobble.findOneAndUpdate(
          { userId, spotifyId, playedAtRounded10s },
          {
            $setOnInsert: {
              userId,
              spotifyId,
              playedAt,
              playedAtRounded10s,
              source: 'spotify',
            },
            $set: {
              trackName,
              artistName,
              albumId,
              albumName,
              albumArt,
              durationMs,
              device,
              clientVersion,
              isScrobbled,
              isSkip: !isScrobbled,
              // Hybrid references
              ...(trackId && { trackId }),
              ...(albumRefId && { albumRefId }),
              ...(artistId && { artistId }),
            },
          },
          { upsert: true, new: true }
        );

        // If duplicate (not newly created), skip stats update
        if (scrobbleDoc && scrobbleDoc.createdAt && new Date(scrobbleDoc.createdAt).getTime() < Date.now() - 1000) {
          results.duplicates++;
          continue;
        }

        if (!isScrobbled) {
          results.skipped++;
          continue;
        }

        results.scrobbled++;

        // ========== Update TrackStats (with replay guard) ==========
        const trackKey = spotifyId || `${artistName}::${trackName}`;
        const existingTrack = await TrackStats.findOne({ userId, trackKey }).select('lastPlayedAt replayGuardAt').lean();

        const replayGuardMs = 15 * 60 * 1000; // 15 minutes
        const shouldUpdateTrack = !existingTrack?.lastPlayedAt || (playedAt.getTime() - new Date(existingTrack.lastPlayedAt).getTime() >= replayGuardMs);

        if (shouldUpdateTrack) {
          await TrackStats.findOneAndUpdate(
            { userId, trackKey },
            {
              $setOnInsert: {
                trackId: spotifyId,
                trackKey,
              },
              $set: {
                trackName,
                artistName,
                albumName,
                albumArt,
                lastPlayedAt: playedAt,
                replayGuardAt: playedAt, // Use playedAt for guard, not processing time
              },
              $inc: { playCount: 1 },
            },
            { upsert: true }
          );
        }

        // ========== Update AlbumStats (4-track min, 70% completion) ==========
        if (!albumId) continue; // Skip albums without IDs

        // Fetch totalTracks (cached)
        const totalTracks = await spotifyService.getAlbumTotalTracks(albumId, accessToken);
        if (!totalTracks || totalTracks < 4) {
          // Skip singles/EPs (< 4 tracks)
          continue;
        }

        const albumKey = albumId || albumName || 'Unknown Album';
        const albumStats = await AlbumStats.findOneAndUpdate(
          { userId, albumKey },
          {
            $setOnInsert: {
              albumId,
              albumKey,
              totalTracks,
              albumPlayCount: 0,
              uniqueTracksPlayed: [],
            },
            $set: {
              albumName,
              artistName,
              albumArt,
              lastPlayedAt: playedAt,
            },
            $inc: { playCount: 1 },
          },
          { upsert: true, new: true }
        );

        // Add track to uniqueTracksPlayed (if not already present)
        const uniqueTracks = Array.isArray(albumStats.uniqueTracksPlayed) ? albumStats.uniqueTracksPlayed : [];
        if (!uniqueTracks.includes(spotifyId)) {
          uniqueTracks.push(spotifyId);

          // Check if 70% threshold reached
          const progressPercent = (uniqueTracks.length / totalTracks) * 100;
          if (progressPercent >= 70) {
            // Completion achieved! Increment albumPlayCount, reset cycle
            await AlbumStats.updateOne(
              { _id: albumStats._id },
              {
                $inc: { albumPlayCount: 1 },
                $set: {
                  uniqueTracksPlayed: [], // Reset for new cycle
                  lastCompletedAt: playedAt,
                },
              }
            );

            // Emit completion event (optional analytics)
            try {
              await CompletionEvent.create({
                userId,
                albumId,
                albumKey,
                albumName: albumName || 'Unknown Album',
                artistName,
                albumArt,
                completedAt: playedAt,
              });
            } catch (e) {
              console.warn('[BATCH UPSERT] CompletionEvent failed:', (e as any)?.message);
            }
          } else {
            // Partial progress: update uniqueTracksPlayed
            await AlbumStats.updateOne(
              { _id: albumStats._id },
              { $set: { uniqueTracksPlayed: uniqueTracks } }
            );
          }
        }

        // ========== Update UserStatsSummary ==========
        await UserStatsSummary.findOneAndUpdate(
          { userId },
          {
            $inc: { totalScrobbles: 1 },
            $set: {
              lastScrobbled: {
                spotifyId,
                trackName,
                artistName,
                albumName,
                playedAt,
              },
            },
          },
          { upsert: true }
        );
      } catch (itemError: any) {
        results.errors.push(`Item ${results.processed}: ${itemError.message}`);
      }
    }

    return res.json(results);
  } catch (error: any) {
    console.error('[BATCH UPSERT] Fatal error:', error.message);
    return res.status(500).json({
      error: 'Batch upsert failed',
      message: error.message,
      results,
    });
  }
});

// =====================================================================
// V2: Get Recent Scrobbles (Paginated, Minimal Projection)
// =====================================================================
router.get('/scrobbles/recent', async (req: Request, res: Response) => {
  const { userId, limit = 20, before, includeSkips } = req.query as {
    userId?: string;
    limit?: string;
    before?: string; // ISO date cursor
    includeSkips?: string;
  };

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  const parsedLimit = Math.min(Number(limit) || 20, 100); // Max 100
  const query: any = { userId };

  // Exclude skips by default (unless includeSkips=1)
  if (includeSkips !== '1' && includeSkips !== 'true') {
    query.isScrobbled = true;
  }

  // Pagination cursor
  if (before) {
    query.playedAt = { $lt: new Date(before) };
  }

  try {
    const scrobbles = await Scrobble.find(query)
      .sort({ playedAt: -1 })
      .limit(parsedLimit)
      .select('spotifyId trackName artistName albumId albumName albumArt durationMs playedAt isScrobbled device')
      .lean();

    const nextCursor = scrobbles.length === parsedLimit ? scrobbles[scrobbles.length - 1].playedAt : null;

    res.json({
      items: scrobbles,
      nextCursor: nextCursor ? new Date(nextCursor).toISOString() : null,
      hasMore: scrobbles.length === parsedLimit,
    });
  } catch (error: any) {
    console.error('[GET SCROBBLES/RECENT] Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch recent scrobbles' });
  }
});

// =====================================================================
// V2: Get Archive-Ready Scrobbles (>83 days old, for device archive)
// =====================================================================
router.get('/scrobbles/archive-ready', async (req: Request, res: Response) => {
  const { userId, before } = req.query as { userId?: string; before?: string };

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  // Default: scrobbles older than 83 days (7 days before TTL expires)
  const cutoffDate = before ? new Date(before) : new Date(Date.now() - 83 * 24 * 60 * 60 * 1000);

  try {
    const scrobbles = await Scrobble.find({
      userId,
      playedAt: { $lt: cutoffDate },
    })
      .sort({ playedAt: 1 }) // Oldest first
      .limit(1000) // Max 1000 per pull
      .select('_id spotifyId trackName artistName albumId albumName albumArt durationMs playedAt playedAtRounded10s isScrobbled device clientVersion')
      .lean();

    res.json({ items: scrobbles, count: scrobbles.length });
  } catch (error: any) {
    console.error('[GET SCROBBLES/ARCHIVE-READY] Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch archive-ready scrobbles' });
  }
});

// =====================================================================
// V2: Acknowledge Archive (Delete after device saves)
// =====================================================================
router.post('/scrobbles/ack-archive', async (req: Request, res: Response) => {
  const { userId, ids } = req.body as { userId?: string; ids?: string[] };

  if (!userId || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'userId and ids[] required' });
  }

  try {
    const result = await Scrobble.deleteMany({
      userId,
      _id: { $in: ids },
    });

    res.json({
      ok: true,
      deleted: result.deletedCount,
    });
  } catch (error: any) {
    console.error('[POST SCROBBLES/ACK-ARCHIVE] Error:', error.message);
    res.status(500).json({ error: 'Failed to acknowledge archive' });
  }
});

// =====================================================================
// LEGACY: Get All Scrobbles (Keep for backward compatibility)
// =====================================================================
router.get('/scrobbles', async (req: Request, res: Response) => {
  const { userId, limit = 50 } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const scrobbles = await Scrobble.find({ userId })
      .sort({ playedAt: -1 })
      .limit(Number(limit));

    res.json(scrobbles);
  } catch (error: any) {
    console.error('Error fetching scrobbles:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch scrobbles',
    });
  }
});

// Get listening stats for a user
router.get('/listening-stats', parseUserId, async (req: Request, res: Response) => {
  const { accessToken, force } = req.query as { accessToken?: string; force?: string };
  const userId = req.userId!; // Validated by parseUserId middleware

  try {
    const cacheKey = `stats_${userId}`;
    const cached = statsCache.get(cacheKey);
    const now = Date.now();
    const wantForce = force === '1' || force === 'true';

    // We need the most recent scrobble timestamp to decide freshness if we have a cached copy.
    // Grab ONLY the latest scrobble's playedAt first (cheap query with select + limit 1).
    const latestScrobble = await Scrobble.findOne({ userId }).sort({ playedAt: -1 }).select('playedAt').lean();
    const latestPlayedAtMs = latestScrobble ? new Date(latestScrobble.playedAt).getTime() : undefined;

    let cacheHit = false;
    if (!wantForce && cached) {
      const ageMs = now - cached.timestamp;
      const ttlValid = ageMs < STATS_CACHE_TTL;
      const scrobbleFresh = latestPlayedAtMs && cached.lastScrobblePlayedAt ? latestPlayedAtMs <= cached.lastScrobblePlayedAt : true;
      if (ttlValid && scrobbleFresh) {
        cacheHit = true;
        // Only log cache hits in development
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[LISTENING STATS] ✅ Cache HIT for user=${userId} age=${ageMs}ms`);
        }
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Age', String(ageMs));
        return res.json({
          ...cached.data,
          cache: {
            hit: true,
            ageMs,
            generatedAt: cached.timestamp,
            lastScrobblePlayedAt: cached.lastScrobblePlayedAt,
          },
        });
      }
      if (process.env.NODE_ENV !== 'production') {
        if (!ttlValid) {
          console.log(`[LISTENING STATS] 🔄 Cache expired (age=${ageMs}ms >= ${STATS_CACHE_TTL}ms)`);
        } else if (!scrobbleFresh) {
          console.log(`[LISTENING STATS] 🔄 New scrobble detected; busting cache`);
        }
      }
    }

    if (wantForce && process.env.NODE_ENV !== 'production') {
      console.log(`[LISTENING STATS] 🚫 Force bypass requested for user=${userId}`);
    }

    // Only log in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[LISTENING STATS] Fetching fresh stats for user: ${userId}`);
    }
    const overallStart = Date.now();
    
    // FAST MODE: Only fetch recent scrobbles (last 200) for instant loading
    const scrobbles = await Scrobble.find({ userId })
      .sort({ playedAt: -1 })
      .limit(200)
      .select('artistName albumName spotifyId durationMs playedAt albumArt') // Only fields we need
      .lean(); 
    
    // Removed excessive logging for production performance

    // Calculate total listening time in minutes
    const totalMinutes = scrobbles.reduce((sum, scrobble) => {
      return sum + (scrobble.durationMs || 0);
    }, 0) / 60000;

    // FAST STATS: Skip album API calls, use scrobble data directly
    let topAlbums: any[] = [];
    let topSingles: any[] = [];
    
    if (scrobbles.length > 0) {
      const albumTracksMap = new Map<string, {
        name: string;
        artist: string;
        albumArt: string;
        uniqueTracks: Set<string>;
        playCount: number;
        totalTimeMs: number;
        scrobbleDurations: number[];
      }>();

      // Group scrobbles by album - fast in-memory operation
      for (const scrobble of scrobbles) {
        if (!scrobble.albumName || !scrobble.spotifyId) continue;
        let album = albumTracksMap.get(scrobble.albumName);
        if (!album) {
          album = {
            name: scrobble.albumName,
            artist: scrobble.artistName || 'Unknown Artist',
            albumArt: scrobble.albumArt || '',
            uniqueTracks: new Set(),
            playCount: 0,
            totalTimeMs: 0,
            scrobbleDurations: [],
          };
          albumTracksMap.set(scrobble.albumName, album);
        }
        album.uniqueTracks.add(scrobble.spotifyId);
        album.playCount++;
        album.scrobbleDurations.push(scrobble.durationMs || 0);
      }

      // Categorize: Singles (1-3 tracks) vs Albums (4+ tracks)
      const validAlbums: any[] = [];
      const singlesCollected: any[] = [];

      for (const album of albumTracksMap.values()) {
        const uniqueTracksPlayed = album.uniqueTracks.size;
        // Only count totalTimeMs if all tracks played (100% completion)
        let totalTimeMs = 0;
        if (uniqueTracksPlayed > 3 && uniqueTracksPlayed === album.playCount) {
          totalTimeMs = album.scrobbleDurations.reduce((a, b) => a + b, 0);
        }
        const albumData = {
          name: album.name,
          artist: album.artist,
          albumArt: album.albumArt,
          count: album.playCount,
          totalTracks: uniqueTracksPlayed,
          totalTimeMs,
        };
        if (uniqueTracksPlayed <= 3) {
          singlesCollected.push(albumData);
        } else {
          validAlbums.push(albumData);
        }
      }

      // Sort by play count and take top 5
      topAlbums = validAlbums.sort((a, b) => b.count - a.count).slice(0, 5);
      topSingles = singlesCollected.sort((a, b) => b.count - a.count).slice(0, 5);
    }

    // Skip genres for now - too slow
    let topGenres: { genre: string; count: number }[] = [];
    
    // Simple top artists from scrobbles (fast, no API calls)
    const artistCounts: Record<string, number> = {};
    for (const scrobble of scrobbles) {
      if (scrobble.artistName) {
        artistCounts[scrobble.artistName] = (artistCounts[scrobble.artistName] || 0) + 1;
      }
    }
    
    const uniqueArtistsCount = Object.keys(artistCounts).length;
    const topArtists = Object.entries(artistCounts)
      .map(([artist, count]) => ({ artist, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    // OPTIMIZATION: Skip genre fetching for now - it's too slow (50 API calls)
    // We can add this back later with proper caching or batch API calls
    if (accessToken && false) { // Disabled for performance
      try {
        // Get artist names with their scrobble counts
        const artistScrobbleCounts = scrobbles.reduce((acc: any, scrobble) => {
          const artist = scrobble.artistName;
          acc[artist] = (acc[artist] || 0) + 1;
          return acc;
        }, {});

        const uniqueArtists = Object.keys(artistScrobbleCounts);
        const genreMap = new Map<string, number>();
        
        // Fetch genres for each unique artist and weight by scrobble count
        for (const artistName of uniqueArtists.slice(0, 50)) {
          try {
            const searchResponse = await axios.get(
              `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`,
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );
            
            const artist = searchResponse.data?.artists?.items?.[0];
            if (artist?.genres) {
              const scrobbleCount = artistScrobbleCounts[artistName];
              artist.genres.forEach((genre: string) => {
                genreMap.set(genre, (genreMap.get(genre) || 0) + scrobbleCount);
              });
            }
          } catch (error) {
            // Skip this artist if search fails
            continue;
          }
        }
        
        topGenres = Array.from(genreMap.entries())
          .map(([genre, count]) => ({ genre, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
      } catch (error) {
        console.error('Error fetching genres:', error);
        // Continue without genres if there's an error
      }
    }

    // Derive album completion sparkline from CompletionEvent (accurate per-completion events)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const completionEvents = await CompletionEvent.find({ userId, completedAt: { $gte: since } })
      .select('albumName artistName albumArt completedAt')
      .sort({ completedAt: -1 })
      .lean();
    const albumStatsDocs = await AlbumStats.find({ userId, albumPlayCount: { $gt: 0 } })
      .select('albumName artistName albumArt albumPlayCount lastCompletedAt')
      .sort({ lastCompletedAt: -1 })
      .limit(50)
      .lean();

    // Build daily trend for last 30 days
    const today = new Date();
    const dayBuckets: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dayBuckets[key] = 0;
    }
    completionEvents.forEach(e => {
      const key = new Date(e.completedAt).toISOString().slice(0, 10);
      if (dayBuckets[key] !== undefined) dayBuckets[key] += 1;
    });
    const dailyCompletionTrend = Object.entries(dayBuckets)
      .sort((a,b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    const totalCompletedAlbumPlays = albumStatsDocs.reduce((sum, s: any) => sum + (s.albumPlayCount || 0), 0);
    const last7DaysCompletions = dailyCompletionTrend.slice(-7).reduce((a,b)=>a+b.count,0);

    // Calculate current completion streak (consecutive days with at least 1 completion, ending today)
    let currentStreak = 0;
    const sortedDays = dailyCompletionTrend.slice().reverse(); // Most recent first
    for (const day of sortedDays) {
      if (day.count > 0) {
        currentStreak++;
      } else {
        break; // Streak broken
      }
    }

    const albumCompletions = {
      totalCompletedAlbums: albumStatsDocs.length,
      totalCompletedAlbumPlays,
      recentCompletions: completionEvents.slice(0, 20).map(e => ({
        albumName: e.albumName,
        artistName: e.artistName,
        albumArt: e.albumArt,
        lastCompletedAt: e.completedAt,
      })),
      dailyCompletionTrend,
      last7DaysCompletions,
      currentStreak,
    };

    const responseData = {
      totalMinutes: Math.round(totalMinutes),
      totalScrobbles: scrobbles.length,
      uniqueArtistsCount,
      topAlbums,
      topSingles,
      topGenres,
      topArtists,
      albumCompletions,
    };

    // Cache the result (store latest scrobble timestamp for freshness invalidation)
    statsCache.set(cacheKey, { data: responseData, timestamp: Date.now(), lastScrobblePlayedAt: latestPlayedAtMs });
    
    // Only log performance in development
    if (process.env.NODE_ENV !== 'production') {
      const totalTime = Date.now() - overallStart;
      console.log(`[LISTENING STATS] ✅ Total request time: ${totalTime}ms`);
    }

    // Generate ETag for this response content
    const etag = `"${crypto.createHash('md5').update(JSON.stringify(responseData)).digest('hex')}"`;
    res.setHeader('ETag', etag);

    // Check if client has cached version (If-None-Match header)
    const clientEtag = req.headers['if-none-match'];
    if (clientEtag === etag) {
      return res.status(304).end();
    }

    const ageMs = 0;
    res.setHeader('X-Cache', cacheHit ? 'HIT' : 'MISS');
    res.setHeader('X-Cache-Age', String(ageMs));
    res.json({
      ...responseData,
      cache: {
        hit: false,
        ageMs,
        generatedAt: Date.now(),
        lastScrobblePlayedAt: latestPlayedAtMs,
        forced: wantForce,
      },
    });
  } catch (error: any) {
    console.error('[LISTENING STATS ERROR]', error);
    console.error('[LISTENING STATS ERROR STACK]', error.stack);
    res.status(500).json({
      error: 'Failed to fetch listening stats',
      message: error.message,
    });
  }
});

/**
 * Filter out skipped tracks using time gap analysis (for sync-recent endpoint)
 */
function filterSkippedTracksForSync(items: any[]): any[] {
  if (items.length === 0) {
    return items;
  }

  const filtered: any[] = [];
  const nowMs = Date.now();

  // Sort by played_at ascending (oldest first)
  const sorted = [...items].sort((a, b) =>
    new Date(a.played_at).getTime() - new Date(b.played_at).getTime()
  );

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    if (!current?.track || !current?.played_at) continue;

    const currentStartMs = new Date(current.played_at).getTime();
    const currentDuration = current.track.duration_ms || 0;
    const scrobbleThreshold = currentDuration * SCROBBLE_THRESHOLD;

    // First track: assume listened
    if (i === 0) {
      filtered.push(current);
      continue;
    }

    // Last track: compare with current time
    if (!next) {
      const timeSinceStartMs = nowMs - currentStartMs;

      if (timeSinceStartMs >= MAX_RECENT_TRACK_AGE_MS || 
          timeSinceStartMs >= scrobbleThreshold - GRACE_MARGIN_MS) {
        filtered.push(current);
      }
      continue;
    }

    // Normal case: compare with next track
    const nextStartMs = new Date(next.played_at).getTime();
    const actualPlaybackMs = nextStartMs - currentStartMs;

    // Pause detection
    if (actualPlaybackMs > currentDuration * PAUSE_DETECTION_MULTIPLIER) {
      filtered.push(current);
      continue;
    }

    // Grace margin check
    if (actualPlaybackMs >= scrobbleThreshold - GRACE_MARGIN_MS) {
      filtered.push(current);
    }
  }

  return filtered;
}

// Sync scrobbles from Spotify 'recently played' so plays while the app was closed are captured
router.post('/sync-recent', async (req: Request, res: Response) => {
  const { accessToken, userId } = req.body as { accessToken?: string; userId?: string };
  if (!accessToken || !userId) {
    return res.status(400).json({ error: 'accessToken and userId required' });
  }

  try {
    // Fetch Recently Played tracks (limit 50)
    const response = await axios.get(
      'https://api.spotify.com/v1/me/player/recently-played?limit=50',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      }
    );

    const items = Array.isArray(response.data?.items) ? response.data.items : [];
    
    if (items.length === 0) {
      return res.json({
        success: true,
        inserted: 0,
        checked: 0,
        skipped: 0,
        items: [],
      });
    }

    // Apply skip detection filter
    const filteredItems = SKIP_DETECTION_ENABLED ? filterSkippedTracksForSync(items) : items;
    const skippedCount = items.length - filteredItems.length;

    let totalInserted = 0;
    const albumStatsMap = new Map<string, any>();
    const trackStatsMap = new Map<string, any>();
    const itemsForClient: any[] = [];

    for (const entry of filteredItems) {
      const track = entry?.track;
      const playedAtStr = entry?.played_at;
      if (!track || !playedAtStr) continue;

      const spotifyId = track.id;
      const trackName = track.name;
      const artistName = (track.artists || []).map((a: any) => a.name).join(', ');
      const albumId = track.album?.id;
      const albumName = track.album?.name;
      const albumArt = track.album?.images?.[0]?.url;
      const durationMs = track.duration_ms ?? 0;
      
      // Round playedAt to 10s for deduplication (same as real-time scrobbling)
      const playedAt = new Date(playedAtStr);
      const roundedMs = Math.floor(playedAt.getTime() / 10000) * 10000;
      const roundedPlayedAt = new Date(roundedMs);

      if (!CLOUD_ENABLE_SCROBBLES) {
        // Collect for client-side local storage
        itemsForClient.push({
          spotifyId,
          trackName,
          artistName,
          albumId,
          albumName,
          albumArt,
          durationMs,
          playedAt: roundedPlayedAt.toISOString(),
        });
      } else {
        try {
          // Try to insert (unique index will prevent duplicates)
          const result = await Scrobble.findOneAndUpdate(
            { userId, spotifyId, playedAt: roundedPlayedAt },
            {
              $setOnInsert: {
                userId,
                spotifyId,
                trackName,
                artistName,
                albumId,
                albumName,
                albumArt,
                durationMs,
                playedAt: roundedPlayedAt,
                source: 'spotify',
              },
            },
            { upsert: true, new: true }
          );

          // If document was just created, count it as new
          if (result && result.createdAt.getTime() === result.updatedAt.getTime()) {
            totalInserted++;

            // Aggregate album stats
            const albumKey = albumId || albumName;
            if (!albumStatsMap.has(albumKey)) {
              albumStatsMap.set(albumKey, {
                albumKey,
                albumId,
                albumName,
                artistName,
                albumArt,
                count: 0,
                lastPlayedAt: roundedPlayedAt,
              });
            }
            const albumStat = albumStatsMap.get(albumKey);
            albumStat.count++;
            if (roundedPlayedAt > albumStat.lastPlayedAt) {
              albumStat.lastPlayedAt = roundedPlayedAt;
            }

            // Aggregate track stats
            const trackKey = spotifyId || trackName;
            if (!trackStatsMap.has(trackKey)) {
              trackStatsMap.set(trackKey, {
                trackKey,
                trackId: spotifyId,
                trackName,
                artistName,
                albumName,
                albumArt,
                durationMs,
                count: 0,
                lastPlayedAt: roundedPlayedAt,
              });
            }
            const trackStat = trackStatsMap.get(trackKey);
            trackStat.count++;
            if (roundedPlayedAt > trackStat.lastPlayedAt) {
              trackStat.lastPlayedAt = roundedPlayedAt;
            }
          }
        } catch (error: any) {
          // Duplicate key error (E11000) is expected, skip it
          if (error.code !== 11000) {
            console.error('Error saving scrobble:', error.message);
          }
        }
      }
    }

    // Update AlbumStats in bulk
    if (albumStatsMap.size > 0) {
      const albumOps = Array.from(albumStatsMap.values()).map((stat) => ({
        updateOne: {
          filter: { userId, albumKey: stat.albumKey },
          update: {
            $setOnInsert: { userId, albumKey: stat.albumKey, albumId: stat.albumId },
            $set: { albumName: stat.albumName, artistName: stat.artistName, albumArt: stat.albumArt },
            $inc: { playCount: stat.count },
            $max: { lastPlayedAt: stat.lastPlayedAt },
          },
          upsert: true,
        },
      }));

      try {
        await AlbumStats.bulkWrite(albumOps, { ordered: false });
      } catch (error: any) {
        console.error('Error updating album stats:', error.message);
      }
    }

    // Update TrackStats in bulk
    if (trackStatsMap.size > 0) {
      const trackOps = Array.from(trackStatsMap.values()).map((stat) => ({
        updateOne: {
          filter: { userId, trackKey: stat.trackKey },
          update: {
            $setOnInsert: { userId, trackKey: stat.trackKey, trackId: stat.trackId },
            $set: {
              trackName: stat.trackName,
              artistName: stat.artistName,
              albumName: stat.albumName,
              albumArt: stat.albumArt,
              durationMs: stat.durationMs,
            },
            $inc: { playCount: stat.count },
            $max: { lastPlayedAt: stat.lastPlayedAt },
          },
          upsert: true,
        },
      }));

      try {
        await TrackStats.bulkWrite(trackOps, { ordered: false });
      } catch (error: any) {
        console.error('Error updating track stats:', error.message);
      }
    }

    // Update UserStatsSummary
    if (totalInserted > 0) {
      try {
        await UserStatsSummary.findOneAndUpdate(
          { userId },
          { $inc: { totalScrobbles: totalInserted } },
          { upsert: true }
        );
      } catch (error: any) {
        console.error('Error updating user stats summary:', error.message);
      }
    }

    res.json({
      success: true,
      inserted: totalInserted,
      checked: items.length,
      skipped: skippedCount,
      items: !CLOUD_ENABLE_SCROBBLES ? itemsForClient : undefined,
    });
  } catch (error: any) {
    console.error('Error syncing recent plays:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to sync recent plays',
      message: error.response?.data?.error?.message || error.message,
    });
  }
});

export default router;


