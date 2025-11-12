import axios from 'axios';
import { cache, CacheKeys, CacheTTL } from '../utils/cacheManager.js';

/**
 * SpotifyService: Minimal data mappers + caching for Spotify API
 * 
 * V2 Design:
 * - Always return minimal shapes (never proxy full Spotify responses)
 * - Cache hot lookups (album totalTracks, track metadata)
 * - Fail gracefully (return undefined, caller decides fallback)
 */

interface MinimalTrack {
  id: string;
  name: string;
  albumId?: string;
  albumName?: string;
  artistId?: string;
  artistName: string;
  durationMs: number;
}

interface MinimalAlbum {
  id: string;
  name: string;
  artistName: string;
  totalTracks: number;
  imageSmall?: string;
}

interface MinimalArtist {
  id: string;
  name: string;
  imageSmall?: string;
}

interface TrackCredit {
  id: string;
  name: string;
  role: string; // 'performer', 'producer', 'writer'
}

interface TrackCredits {
  trackId: string;
  artists: TrackCredit[];
  producers?: TrackCredit[];
  writers?: TrackCredit[];
}

class SpotifyService {
  /**
   * Get album totalTracks (cached for 7 days)
   * Used for album completion logic (only process if >= 4 tracks)
   */
  async getAlbumTotalTracks(albumId: string, accessToken: string): Promise<number | undefined> {
    const cacheKey = CacheKeys.spotifyAlbum(albumId);
    const cached = cache.get<{ totalTracks: number }>(cacheKey);
    if (cached) {
      return cached.data.totalTracks;
    }

    try {
      const resp = await axios.get(`https://api.spotify.com/v1/albums/${albumId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 5000,
      });
      const totalTracks = resp.data?.total_tracks || resp.data?.tracks?.total || 0;
      
      // Cache for 7 days (albums rarely change track count)
      cache.set(cacheKey, { totalTracks }, CacheTTL.long, 'spotify');
      return totalTracks;
    } catch (error: any) {
      console.warn(`[SpotifyService] Failed to fetch album ${albumId}:`, error.response?.status || error.message);
      return undefined;
    }
  }

  /**
   * Map Spotify track object to minimal shape
   */
  mapTrack(spotifyTrack: any): MinimalTrack {
    return {
      id: spotifyTrack.id,
      name: spotifyTrack.name,
      albumId: spotifyTrack.album?.id,
      albumName: spotifyTrack.album?.name,
      artistId: spotifyTrack.artists?.[0]?.id,
      artistName: (spotifyTrack.artists || []).map((a: any) => a.name).join(', '),
      durationMs: spotifyTrack.duration_ms || 0,
    };
  }

  /**
   * Map Spotify album object to minimal shape
   */
  mapAlbum(spotifyAlbum: any): MinimalAlbum {
    return {
      id: spotifyAlbum.id,
      name: spotifyAlbum.name,
      artistName: (spotifyAlbum.artists || []).map((a: any) => a.name).join(', '),
      totalTracks: spotifyAlbum.total_tracks || spotifyAlbum.tracks?.total || 0,
      imageSmall: spotifyAlbum.images?.find((img: any) => img.width && img.width <= 300)?.url || spotifyAlbum.images?.[0]?.url,
    };
  }

  /**
   * Map Spotify artist object to minimal shape
   */
  mapArtist(spotifyArtist: any): MinimalArtist {
    return {
      id: spotifyArtist.id,
      name: spotifyArtist.name,
      imageSmall: spotifyArtist.images?.find((img: any) => img.width && img.width <= 300)?.url || spotifyArtist.images?.[0]?.url,
    };
  }

  /**
   * Fetch track credits (artists, producers, writers) - not cached, rarely called
   * NOTE: Spotify does NOT provide a dedicated credits endpoint - this would require
   * scraping or third-party APIs. For now, return only artists from track object.
   */
  async getTrackCredits(trackId: string, accessToken: string): Promise<TrackCredits | undefined> {
    try {
      const resp = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 5000,
      });
      const track = resp.data;
      const artists: TrackCredit[] = (track.artists || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        role: 'performer',
      }));

      return {
        trackId,
        artists,
        // producers/writers require external data sources
      };
    } catch (error: any) {
      console.warn(`[SpotifyService] Failed to fetch track credits ${trackId}:`, error.response?.status || error.message);
      return undefined;
    }
  }

  /**
   * Fetch currently playing track (minimal shape)
   * NOTE: This is a convenience wrapper - main logic stays in routes for now
   */
  async getCurrentlyPlaying(accessToken: string): Promise<any | undefined> {
    try {
      const resp = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 5000,
      });
      if (resp.status === 204 || !resp.data?.item) {
        return undefined;
      }
      return resp.data;
    } catch (error: any) {
      console.warn('[SpotifyService] Failed to fetch currently playing:', error.response?.status || error.message);
      return undefined;
    }
  }
}

// Singleton instance
export const spotifyService = new SpotifyService();
export default spotifyService;
