import { Router, Request, Response } from 'express';
import { cache, CacheKeys, CacheTTL } from '../utils/cacheManager';
import { cachedSuccess, error } from '../utils/response';
import Scrobble from '../models/Scrobble';
import Review from '../models/Review';
import axios from 'axios';

const router = Router();

// Spotify playlist IDs for different regions/moods
const SPOTIFY_PLAYLISTS = {
  global: {
    top50: '37i9dQZEVXbMDoHDwVN2tF', // Global Top 50
    viral50: '37i9dQZEVXbLiRSasKsNU9', // Global Viral 50
  },
  us: {
    top50: '37i9dQZEVXbLRQDuF5jeBp', // US Top 50
  },
  india: {
    top50: '37i9dQZEVXbLZ52XmnySJg', // India Top 50
    viral50: '37i9dQZEVXbMWDif5SCBJq', // India Viral 50
  },
  discover: '37i9dQZEVXcQ9COmYvdajy', // Discover Weekly (example)
  newReleases: '37i9dQZF1DX4JAvHpjipBk', // New Music Friday
};

// User-specific "Made For You" playlists (require user context)
async function getUserMadeForYouPlaylists(accessToken: string) {
  try {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const response = await axios.get('https://api.spotify.com/v1/me/playlists?limit=50', { headers });
    const playlists = response.data.items || [];
    
    // Filter for Spotify-generated personalized playlists
    const madeForYou = playlists.filter((p: any) => 
      p.owner.id === 'spotify' && (
        p.name.includes('Discover Weekly') || 
        p.name.includes('Release Radar') ||
        p.name.includes('Daily Mix') ||
        p.name.includes('On Repeat') ||
        p.name.includes('Repeat Rewind')
      )
    ).slice(0, 6); // Top 6 personalized playlists
    
    return madeForYou;
  } catch (error) {
    console.error('[DISCOVER] Failed to fetch Made For You playlists:', error);
    return [];
  }
}

router.get('/', async (req: Request, res: Response) => {
  const { limit = '20', accessToken, region = 'global', force } = req.query as { limit?: string; accessToken?: string; region?: string; force?: string };
  
  if (!accessToken) {
    return error(res, 'Spotify access token required for discovery features', 401);
  }

  // Build cache key with region and limit
  const cacheKey = `${CacheKeys.discoverFeed('global')}_${region}_${limit}`;
  const forceFetch = force === '1' || force === 'true';
  
  // Check cache first (unless forced)
  if (!forceFetch) {
    const cached = cache.get<any>(cacheKey);
    if (cached) {
      console.log('[DISCOVER] Cache HIT for', cacheKey);
      return cachedSuccess(res, cached.data, cached.metadata);
    }
  }

  const n = Math.max(1, Math.min(50, Number(limit) || 20));

  try {
    const headers = { Authorization: `Bearer ${accessToken}` };

    console.log('[DISCOVER] Fetching Spotify data for region:', region);

    // Map region to Spotify country code (default to US if not specified)
    const countryCode = region === 'india' ? 'IN' : region === 'us' ? 'US' : 'US';

    // Parallel fetch of all Spotify data
    const [
      newReleasesResponse,
      recommendationsResponse,
      featuredPlaylistsResponse,
      madeForYouPlaylists,
      trendingAlbumsResponse,
      topTracksResponse,
    ] = await Promise.all([
      // New Releases (albums) - Use country-specific
      axios.get(`https://api.spotify.com/v1/browse/new-releases?limit=${n}&country=${countryCode}`, { headers }).catch((err) => {
        console.error('[DISCOVER] New Releases fetch failed:', err.response?.data || err.message);
        return null;
      }),
      
      // Personalized Recommendations (based on user's top tracks)
      axios.get(`https://api.spotify.com/v1/me/top/tracks?limit=5&time_range=short_term`, { headers })
        .then(topTracks => {
          if (!topTracks?.data?.items?.length) {
            console.log('[DISCOVER] No top tracks for recommendations, using seed artists');
            // Fallback to popular seed artists if no listening history
            return axios.get(`https://api.spotify.com/v1/recommendations?seed_artists=06HL4z0CvFAxyc27GXpf02,3TVXtAsR1Inumwj472S9r4,1dfeR4HaWDbWqFHLkxsg1d&limit=${n}`, { headers });
          }
          const seedTracks = topTracks.data.items.slice(0, 5).map((t: any) => t.id).join(',');
          return axios.get(`https://api.spotify.com/v1/recommendations?seed_tracks=${seedTracks}&limit=${n}`, { headers });
        })
        .catch((err) => {
          console.error('[DISCOVER] Recommendations fetch failed:', err.response?.data || err.message);
          return null;
        }),
      
      // Featured Playlists (curated by Spotify) - Requires country code
      axios.get(`https://api.spotify.com/v1/browse/featured-playlists?limit=10&country=${countryCode}`, { headers }).catch((err) => {
        console.error('[DISCOVER] Featured Playlists fetch failed:', err.response?.data || err.message);
        return null;
      }),
      
      // User's "Made For You" playlists (Discover Weekly, Release Radar, Daily Mix, etc.)
      getUserMadeForYouPlaylists(accessToken as string).catch((err) => {
        console.error('[DISCOVER] Made For You playlists fetch failed:', err.response?.data || err.message);
        return null;
      }),
      
      // Trending Albums (from New Album Releases - get more for sorting)
      axios.get(`https://api.spotify.com/v1/browse/new-releases?limit=50&country=${countryCode}`, { headers }).catch((err) => {
        console.error('[DISCOVER] Trending Albums fetch failed:', err.response?.data || err.message);
        return null;
      }),

      // Top Tracks (use user's top tracks as "trending" since Spotify doesn't have a public top tracks endpoint)
      axios.get(`https://api.spotify.com/v1/me/top/tracks?limit=${n}&time_range=short_term`, { headers }).catch((err) => {
        console.error('[DISCOVER] Top Tracks fetch failed:', err.response?.data || err.message);
        return null;
      }),
    ]);

    // Parse Top Tracks (user's personal top tracks)
    const topTracks = topTracksResponse?.data?.items?.map((track: any, idx: number) => ({
      rank: idx + 1,
      trackId: track.id,
      trackName: track.name,
      artistName: track.artists.map((a: any) => a.name).join(', '),
      albumName: track.album.name,
      albumId: track.album.id,
      albumArt: track.album.images?.[0]?.url,
      previewUrl: track.preview_url,
      spotifyUri: `spotify:track:${track.id}`,
      spotifyUrl: `https://open.spotify.com/track/${track.id}`,
      popularity: track.popularity,
    })) || [];

    // Parse New Releases (Albums)
    const newReleases = newReleasesResponse?.data?.albums?.items?.map((album: any) => ({
      albumId: album.id,
      albumName: album.name,
      artistName: album.artists.map((a: any) => a.name).join(', '),
      albumArt: album.images?.[0]?.url,
      releaseDate: album.release_date,
      totalTracks: album.total_tracks,
      spotifyUri: `spotify:album:${album.id}`,
      spotifyUrl: `https://open.spotify.com/album/${album.id}`,
    })) || [];

    // Parse Recommendations
    const recommendations = recommendationsResponse?.data?.tracks?.map((track: any) => ({
      trackId: track.id,
      trackName: track.name,
      artistName: track.artists.map((a: any) => a.name).join(', '),
      albumName: track.album.name,
      albumId: track.album.id,
      albumArt: track.album.images?.[0]?.url,
      previewUrl: track.preview_url,
      spotifyUri: `spotify:track:${track.id}`,
      spotifyUrl: `https://open.spotify.com/track/${track.id}`,
      popularity: track.popularity,
    })) || [];

    // Parse Featured Playlists
    const featuredPlaylists = featuredPlaylistsResponse?.data?.playlists?.items?.map((playlist: any) => ({
      playlistId: playlist.id,
      playlistName: playlist.name,
      description: playlist.description,
      coverArt: playlist.images?.[0]?.url,
      owner: playlist.owner.display_name,
      totalTracks: playlist.tracks.total,
      spotifyUri: `spotify:playlist:${playlist.id}`,
      spotifyUrl: `https://open.spotify.com/playlist/${playlist.id}`,
    })) || [];

      // Parse Made For You Playlists (user-specific)
      const madeForYou = madeForYouPlaylists.map((playlist: any) => ({
        playlistId: playlist.id,
        playlistName: playlist.name,
        description: playlist.description,
        coverArt: playlist.images?.[0]?.url,
        owner: playlist.owner.display_name,
        totalTracks: playlist.tracks.total,
        spotifyUri: `spotify:playlist:${playlist.id}`,
        spotifyUrl: `https://open.spotify.com/playlist/${playlist.id}`,
      }));

      // Parse Trending Albums (sort by popularity if available)
      const trendingAlbums = trendingAlbumsResponse?.data?.albums?.items
        ?.sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))
        .slice(0, 20)
        .map((album: any, idx: number) => ({
          rank: idx + 1,
          albumId: album.id,
          albumName: album.name,
          artistName: album.artists.map((a: any) => a.name).join(', '),
          albumArt: album.images?.[0]?.url,
          releaseDate: album.release_date,
          totalTracks: album.total_tracks,
          popularity: album.popularity,
          spotifyUri: `spotify:album:${album.id}`,
          spotifyUrl: `https://open.spotify.com/album/${album.id}`,
        })) || [];

    // Get community reviews (from our database)
    const publicReviews = await Review.find({ isPublic: true })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('userId itemType spotifyId itemName artistName rating reviewText likes createdAt albumArt');

    const responseData = {
        // === PERSONALIZED SECTIONS (User-specific) ===
        madeForYou: madeForYou.length ? {
          title: '� Made For You',
          description: 'Your personalized playlists from Spotify',
          playlists: madeForYou,
        } : null,
      recommendations: recommendations.length ? {
          title: '✨ Recommended Tracks',
          description: 'Tracks picked just for you based on your taste',
        tracks: recommendations,
      } : null,
        newReleases: {
          title: '🆕 New Albums You Might Like',
          description: 'Fresh releases tailored to your taste',
          albums: newReleases,
        },
      
        // === GLOBAL TRENDING (Same for everyone) ===
        trendingAlbums: trendingAlbums.length ? {
          title: '🌍 Trending Albums',
          description: 'Most popular new albums right now',
          albums: trendingAlbums,
        } : null,
        trendingTracks: topTracks.length ? {
          title: '🔥 Your Top Tracks',
          description: 'Your most listened to songs recently',
          tracks: topTracks,
        } : null,
      
        // === OTHER SECTIONS ===
      featuredPlaylists: featuredPlaylists.length ? {
        title: '� Curated Playlists',
          description: "Playlists hand-picked by Spotify's editors",
        playlists: featuredPlaylists,
      } : null,
      communityReviews: {
        title: '💬 Community Reviews',
        description: 'What others are saying',
        reviews: publicReviews,
      },
      generatedAt: new Date().toISOString(),
      region: region,
      source: 'spotify-charts',
    };

    // Cache the result for 5 minutes (long TTL for external API data)
    cache.set(cacheKey, responseData, CacheTTL.long, 'spotify');
    console.log('[DISCOVER] Cache MISS - fetched fresh Spotify data for', cacheKey);

    return cachedSuccess(res, responseData, {
      source: forceFetch ? 'spotify' : 'spotify',
      cachedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + CacheTTL.long * 1000).toISOString(),
      isFresh: true,
    });
  } catch (err: any) {
    console.error('Error building discover payload:', err?.message || err);
    return error(res, 'Failed to build discover payload', 500);
  }
});

export default router;