import { Router, Request, Response } from 'express';
import axios from 'axios';
import mongoose from 'mongoose';
import Scrobble from '../models/Scrobble.js';
import UserStatsSummary from '../models/UserStatsSummary.js';
import User from '../models/User.js';

const router = Router();
const CLOUD_ENABLE_SCROBBLES = (process.env.CLOUD_ENABLE_SCROBBLES ?? 'true') !== 'false';
const CLOUD_SCROBBLE_RETENTION_DAYS = Number(process.env.CLOUD_SCROBBLE_RETENTION_DAYS) || 30;

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
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q as string)}&type=${type}&limit=50`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    // Return in original format for backward compatibility
    res.json(response.data);
  } catch (error: any) {
    console.error('Error searching music:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Search failed' 
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
        console.log(`[LISTENING STATS] ✅ Cache HIT for user=${userId} age=${ageMs}ms`);
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
      if (!ttlValid) {
        console.log(`[LISTENING STATS] 🔄 Cache expired (age=${ageMs}ms >= ${STATS_CACHE_TTL}ms)`);
      } else if (!scrobbleFresh) {
        console.log(`[LISTENING STATS] 🔄 New scrobble detected; busting cache`);
      }
    }

    if (wantForce) {
      console.log(`[LISTENING STATS] 🚫 Force bypass requested for user=${userId}`);
    }

    console.log(`[LISTENING STATS] Fetching fresh stats for user: ${userId}`);
    const overallStart = Date.now();
    
    // FAST MODE: Only fetch recent scrobbles (last 200) for instant loading
    const scrobbles = await Scrobble.find({ userId })
      .sort({ playedAt: -1 })
      .limit(200)
      .select('artistName albumName spotifyId durationMs playedAt albumArt') // Only fields we need
      .lean(); 
    
    console.log(`[LISTENING STATS] Found ${scrobbles.length} scrobbles`);

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

    const responseData = {
      totalMinutes: Math.round(totalMinutes),
      totalScrobbles: scrobbles.length,
      uniqueArtistsCount,
      topAlbums,
      topSingles,
      topGenres,
      topArtists,
    };

    // Cache the result (store latest scrobble timestamp for freshness invalidation)
    statsCache.set(cacheKey, { data: responseData, timestamp: Date.now(), lastScrobblePlayedAt: latestPlayedAtMs });
    
    const totalTime = Date.now() - overallStart;
    console.log(`[LISTENING STATS] ✅ Total request time: ${totalTime}ms`);

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

// Sync scrobbles from Spotify 'recently played' so plays while the app was closed are captured
router.post('/sync-recent', async (req: Request, res: Response) => {
  const { accessToken, userId } = req.body as { accessToken?: string; userId?: string };
  if (!accessToken || !userId) {
    return res.status(400).json({ error: 'accessToken and userId required' });
  }

  try {
    // Start after the most recent scrobble we have
    const latest = await Scrobble.findOne({ userId }).sort({ playedAt: -1 }).lean();
    let cursorAfter = latest ? new Date(latest.playedAt).getTime() : undefined;

    let totalInserted = 0;
    let totalChecked = 0;
    let pages = 0;
    const MAX_PAGES = 10; // up to ~500 recent plays

    const itemsForClient: any[] = [];
    while (pages < MAX_PAGES) {
      const params = new URLSearchParams({ limit: '50' });
      if (cursorAfter) params.set('after', String(cursorAfter));

      const response = await axios.get(
        `https://api.spotify.com/v1/me/player/recently-played?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const items = Array.isArray(response.data?.items) ? response.data.items : [];
      totalChecked += items.length;

      if (items.length === 0) break;

      let maxPlayedAtMs = cursorAfter || 0;

      for (const entry of items) {
        const track = entry?.track;
        const playedAtStr = entry?.played_at;
        if (!track || !playedAtStr) continue;

        const playedAt = new Date(playedAtStr);
        const playedAtMs = playedAt.getTime();
        if (playedAtMs > maxPlayedAtMs) maxPlayedAtMs = playedAtMs;

        const durationMs = track.duration_ms ?? 0;
        const trackName = track.name;
        const artistName = (track.artists || []).map((a: any) => a.name).join(', ');
        const albumId = track.album?.id;
        const albumName = track.album?.name;
        const albumArt = track.album?.images?.[0]?.url;
        if (!CLOUD_ENABLE_SCROBBLES) {
          // Do not persist; collect for client-side local storage
          itemsForClient.push({
            spotifyId: track.id,
            trackName,
            artistName,
            albumId,
            albumName,
            albumArt,
            durationMs,
            playedAt: playedAt.toISOString(),
          });
        } else {
          const existing = await Scrobble.findOne({ userId, spotifyId: track.id, playedAt });
          if (existing) continue;
          await Scrobble.create({
            userId,
            spotifyId: track.id,
            trackName,
            artistName,
            albumName,
            albumArt,
            durationMs,
            playedAt,
            source: 'spotify',
          });
          totalInserted += 1;
        }
      }

      pages += 1;
      // If fewer than 50 returned, we've reached the end
      if (items.length < 50) break;

      // Advance cursor past the newest item we processed to get the next page
      cursorAfter = (maxPlayedAtMs || 0) + 1;
    }

    res.json({
      success: true,
      inserted: totalInserted,
      checked: totalChecked,
      pages,
      startAfter: latest ? new Date(latest.playedAt).getTime() : null,
      endAfter: cursorAfter ?? null,
      items: !CLOUD_ENABLE_SCROBBLES ? itemsForClient : undefined,
    });
  } catch (error: any) {
    console.error('Error syncing recent plays:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: 'Failed to sync recent plays' });
  }
});

export default router;
