import { Router, Request, Response } from 'express';
import axios from 'axios';
import mongoose from 'mongoose';
import crypto from 'crypto';
import Scrobble from '../models/Scrobble.js';
import UserStatsSummary from '../models/UserStatsSummary.js';
import AlbumStats from '../models/AlbumStats.js';
import TrackStats from '../models/TrackStats.js';
import CompletionEvent from '../models/CompletionEvent.js';
import User from '../models/User.js';

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
  const { accessToken, q, type = 'track,album' } = req.query;

  if (!accessToken || !q) {
    return res.status(400).json({ error: 'Access token and query required' });
  }

  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q as string)}&type=${type}&limit=20`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000, // 15 second timeout for Spotify API
      }
    );

    // Return in original format for backward compatibility
    res.json(response.data);
  } catch (error: any) {
    console.error('Error searching music:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Search failed',
      message: error.message 
    });
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
    console.error('Error fetching album details:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch album details',
    });
  }
});

// Get currently playing track (for scrobbling)
router.get('/currently-playing', async (req: Request, res: Response) => {
  const { accessToken } = req.query;

  if (!accessToken) {
    return res.status(400).json({ error: 'Access token required' });
  }

  try {
    const response = await axios.get(
      'https://api.spotify.com/v1/me/player/currently-playing',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (response.status === 204 || !response.data) {
      return res.json({ isPlaying: false });
    }

    res.json({
      isPlaying: response.data.is_playing,
      track: response.data.item,
      progressMs: response.data.progress_ms,
      timestamp: response.data.timestamp,
    });
  } catch (error: any) {
    console.error('Error fetching currently playing:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch currently playing track' 
    });
  }
});

// Get recently played tracks (for auto-scrobbling)
router.get('/recently-played', async (req: Request, res: Response) => {
  const { accessToken, limit = 50 } = req.query;

  if (!accessToken) {
    return res.status(400).json({ error: 'Access token required' });
  }

  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/me/player/recently-played?limit=${limit}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('Error fetching recently played:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch recently played tracks' 
    });
  }
});

// Create a scrobble entry based on the user's currently playing track
router.post('/scrobble', async (req: Request, res: Response) => {
  const { accessToken, userId } = req.body;

  if (!accessToken || !userId) {
    return res.status(400).json({ error: 'Access token and userId required' });
  }

  // ROOT FIX: Ensure user exists BEFORE allowing scrobble so we never end up with
  // scrobbles referencing a missing user document. If it's missing, attempt to
  // reconstruct minimal User from Spotify /me. If that fails, instruct client to re-auth.
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid userId format' });
    }
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
      return res.json({ scrobbled: false, message: 'Nothing currently playing' });
    }

    const { item, is_playing, progress_ms, timestamp } = response.data;

    if (!is_playing || !item) {
      return res.json({ scrobbled: false, message: 'Playback is paused' });
    }

    const progressMs = progress_ms ?? 0;
    const durationMs = item.duration_ms ?? 0;
    const minProgressForScrobble = durationMs * 0.4; // 40% threshold (aligned with client)
    
    // Only scrobble if track is played 40% or more
    if (progressMs < minProgressForScrobble || durationMs === 0) {
      return res.json({ scrobbled: false, message: 'Minimum play time not reached (40%)' });
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

      return res.json({
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
        },
      },
      { upsert: true, new: true }
    );

    // Update AlbumStats: playCount and completion metrics
    try {
      const albumId: string | undefined = item.album?.id;
      const albumNameSafe: string = albumName || 'Unknown Album';
      const albumKey: string = albumId || albumNameSafe;

      // 1) Upsert base stats and increment playCount
      const stats = await AlbumStats.findOneAndUpdate(
        { userId: String(userId), albumKey },
        {
          $setOnInsert: {
            albumId,
            albumKey,
            albumName: albumNameSafe,
            artistName,
            albumArt,
            totalTracks: undefined,
            completedPlays: 0,
          },
          $set: { lastPlayedAt: playedAt, albumArt, artistName, albumName: albumNameSafe },
          $inc: { playCount: 1 },
        },
        { upsert: true, new: true }
      );

      // 2) Ensure totalTracks exists (one-time fetch) if albumId present
      let totalTracks = stats.totalTracks;
      if (!totalTracks && albumId) {
        try {
          const albumResp = await axios.get(`https://api.spotify.com/v1/albums/${albumId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          totalTracks = albumResp.data?.total_tracks || albumResp.data?.tracks?.total || 0;
          if (totalTracks && totalTracks > 0) {
            await AlbumStats.updateOne(
              { _id: stats._id },
              { $set: { totalTracks } }
            );
          }
        } catch {}
      }

      // 3) If we know totalTracks, update per-cycle progress to count multiple full plays.
      if (totalTracks && totalTracks > 0) {
        // Reload fresh snapshot to get currentCycleUniqueTrackIds
        const fresh = await AlbumStats.findById(stats._id).select('currentCycleUniqueTrackIds completedPlays').lean();
        const seen: string[] = Array.isArray(fresh?.currentCycleUniqueTrackIds) ? fresh!.currentCycleUniqueTrackIds : [];
        const already = seen.includes(item.id);
        if (!already) {
          seen.push(item.id);
        }
        if (seen.length >= totalTracks) {
          // Completion achieved for this cycle
          await AlbumStats.updateOne(
            { _id: stats._id },
            {
              $inc: { completedPlays: 1 },
              $set: { lastCompletedAt: playedAt, currentCycleUniqueTrackIds: [] },
            }
          );
          // Emit a completion event for time-series analytics
          try {
            await CompletionEvent.create({
              userId: String(userId),
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
            { $set: { currentCycleUniqueTrackIds: seen } }
          );
        }
      }
    } catch (e) {
      console.warn('[SCROBBLE] AlbumStats update skipped:', (e as any)?.message || e);
    }

    return res.json({ scrobbled: true, scrobble });
  } catch (error: any) {
    console.error('Error scrobbling track:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to scrobble track',
    });
  }
});

// Fetch scrobbles for a user
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
router.get('/listening-stats', async (req: Request, res: Response) => {
  const { userId, accessToken, force } = req.query as { userId?: string; accessToken?: string; force?: string };

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

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
    const completionEvents = await CompletionEvent.find({ userId: String(userId), completedAt: { $gte: since } })
      .select('albumName artistName albumArt completedAt')
      .sort({ completedAt: -1 })
      .lean();
    const albumStatsDocs = await AlbumStats.find({ userId: String(userId), completedPlays: { $gt: 0 } })
      .select('albumName artistName albumArt completedPlays lastCompletedAt')
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

    const totalCompletedAlbumPlays = albumStatsDocs.reduce((sum, s: any) => sum + (s.completedPlays || 0), 0);
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
