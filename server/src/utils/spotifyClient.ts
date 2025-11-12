import axios, { AxiosError } from 'axios';
import User from '../models/User.js';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string; id: string }>;
  album: {
    id: string;
    name: string;
    images: Array<{ url: string }>;
  };
  duration_ms: number;
  uri: string;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  artists: Array<{ name: string; id: string }>;
  images: Array<{ url: string }>;
  release_date: string;
  total_tracks: number;
  tracks: {
    items: Array<SpotifyTrack>;
  };
}

export interface SpotifyCurrentlyPlaying {
  item: SpotifyTrack | null;
  is_playing: boolean;
  progress_ms: number;
  timestamp: number;
}

export interface SpotifySearchResults {
  tracks?: {
    items: SpotifyTrack[];
  };
  albums?: {
    items: SpotifyAlbum[];
  };
}

export interface SpotifyApiResult<T> {
  data: T;
  refreshedToken?: string; // New access token if rotation occurred
}

/**
 * Centralized Spotify API client with automatic token refresh
 * Handles all external Spotify API calls with consistent error handling
 */
export class SpotifyClient {
  /**
   * Get user's currently playing track
   */
  async getCurrentlyPlaying(userId: string): Promise<SpotifyApiResult<SpotifyCurrentlyPlaying | null>> {
    try {
      const response = await this.call<SpotifyCurrentlyPlaying>(
        `${SPOTIFY_API_BASE}/me/player/currently-playing`,
        userId
      );
      return response;
    } catch (error: any) {
      // 204 means nothing is playing
      if (error?.response?.status === 204) {
        return { data: null };
      }
      throw error;
    }
  }

  /**
   * Get user's recently played tracks
   */
  async getRecentlyPlayed(userId: string, limit = 50): Promise<SpotifyApiResult<{ items: Array<{ track: SpotifyTrack; played_at: string }> }>> {
    return this.call(
      `${SPOTIFY_API_BASE}/me/player/recently-played?limit=${limit}`,
      userId
    );
  }

  /**
   * Search for tracks, albums, or artists
   */
  async search(query: string, type: 'track' | 'album' | 'artist', userId: string, limit = 20): Promise<SpotifyApiResult<SpotifySearchResults>> {
    const encodedQuery = encodeURIComponent(query);
    return this.call(
      `${SPOTIFY_API_BASE}/search?q=${encodedQuery}&type=${type}&limit=${limit}`,
      userId
    );
  }

  /**
   * Get album details including all tracks
   */
  async getAlbum(albumId: string, userId: string): Promise<SpotifyApiResult<SpotifyAlbum>> {
    return this.call(
      `${SPOTIFY_API_BASE}/albums/${albumId}`,
      userId
    );
  }

  /**
   * Get artist's top tracks
   */
  async getArtistTopTracks(artistId: string, userId: string, market = 'US'): Promise<SpotifyApiResult<{ tracks: SpotifyTrack[] }>> {
    return this.call(
      `${SPOTIFY_API_BASE}/artists/${artistId}/top-tracks?market=${market}`,
      userId
    );
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<SpotifyApiResult<any>> {
    return this.call(
      `${SPOTIFY_API_BASE}/me`,
      userId
    );
  }

  /**
   * Get new releases
   */
  async getNewReleases(userId: string, country = 'US', limit = 20): Promise<SpotifyApiResult<{ albums: { items: SpotifyAlbum[] } }>> {
    return this.call(
      `${SPOTIFY_API_BASE}/browse/new-releases?country=${country}&limit=${limit}`,
      userId
    );
  }

  /**
   * Get recommendations based on seed tracks/artists
   */
  async getRecommendations(seedTracks: string, userId: string, limit = 20): Promise<SpotifyApiResult<{ tracks: SpotifyTrack[] }>> {
    return this.call(
      `${SPOTIFY_API_BASE}/recommendations?seed_tracks=${seedTracks}&limit=${limit}`,
      userId
    );
  }

  /**
   * Core method: Make Spotify API call with automatic token refresh
   */
  private async call<T>(url: string, userId: string, retryCount = 0): Promise<SpotifyApiResult<T>> {
    // Max 1 retry to prevent infinite loops
    if (retryCount > 1) {
      throw new Error('Maximum retry attempts exceeded for Spotify API call');
    }

    // Get user and access token
    const user = await User.findOne({
      $or: [{ _id: userId }, { spotifyId: userId }],
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check token status
    if (user.tokenStatus === 'revoked') {
      const error: any = new Error('Token revoked');
      error.statusCode = 401;
      error.code = 'SPOTIFY_TOKEN_REVOKED';
      error.message = 'Your Spotify session has expired. Please log in again.';
      throw error;
    }

    try {
      // Make Spotify API call
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${user.accessToken}` },
        timeout: 10000,
      });

      // Mark token as active if it was working
      if (user.tokenStatus !== 'active') {
        user.tokenStatus = 'active';
        user.consecutiveRefreshFailures = 0;
        await user.save();
      }

      return { data: response.data };
    } catch (error: any) {
      const status = error?.response?.status;

      // If 401, try to refresh token
      if (status === 401 && retryCount === 0) {
        console.log(`🔄 Access token expired for user ${userId}, attempting refresh...`);

        const refreshResult = await this.refreshUserToken(user);

        if (refreshResult.success) {
          console.log(`✅ Token refreshed successfully, retrying request...`);
          // Retry the original request with new token
          const retryResult = await this.call<T>(url, userId, retryCount + 1);
          // Include the refreshed token in response
          return {
            data: retryResult.data,
            refreshedToken: refreshResult.newAccessToken,
          };
        } else {
          // Refresh failed - mark user as revoked
          user.tokenStatus = 'revoked';
          user.lastTokenError = refreshResult.error || 'refresh_failed';
          user.lastTokenErrorAt = new Date();
          user.consecutiveRefreshFailures = (user.consecutiveRefreshFailures || 0) + 1;
          await user.save();

          const refreshError: any = new Error('Token refresh failed');
          refreshError.statusCode = 401;
          refreshError.code = 'SPOTIFY_TOKEN_EXPIRED';
          refreshError.message = 'Your Spotify session has expired. Please log in again.';
          refreshError.details = refreshResult.error;
          throw refreshError;
        }
      }

      // Not a 401 or retry failed - throw original error
      throw this.normalizeError(error);
    }
  }

  /**
   * Refresh user's Spotify access token
   */
  private async refreshUserToken(user: any): Promise<{ success: boolean; newAccessToken?: string; error?: string }> {
    try {
      // Try standard refresh (with client secret)
      const response = await axios.post(
        SPOTIFY_TOKEN_URL,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: user.refreshToken,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(
              `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
            ).toString('base64')}`,
          },
          timeout: 5000,
        }
      );

      const data = response.data;

      // Update tokens
      user.accessToken = data.access_token;
      if (data.refresh_token) {
        user.refreshToken = data.refresh_token;
      }
      user.tokenStatus = 'active';
      user.lastTokenRefreshAt = new Date();
      user.consecutiveRefreshFailures = 0;
      await user.save();

      return {
        success: true,
        newAccessToken: data.access_token,
      };
    } catch (error: any) {
      const status = error?.response?.status;
      const errorData = error?.response?.data;

      // If invalid_client, try PKCE-style refresh (no secret)
      if ((status === 400 || status === 401) && errorData?.error === 'invalid_client') {
        try {
          const pkceResponse = await axios.post(
            SPOTIFY_TOKEN_URL,
            new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: user.refreshToken,
              client_id: process.env.SPOTIFY_CLIENT_ID || '',
            }),
            {
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              timeout: 5000,
            }
          );

          const pkceData = pkceResponse.data;
          user.accessToken = pkceData.access_token;
          if (pkceData.refresh_token) {
            user.refreshToken = pkceData.refresh_token;
          }
          user.tokenStatus = 'active';
          user.lastTokenRefreshAt = new Date();
          user.consecutiveRefreshFailures = 0;
          await user.save();

          return {
            success: true,
            newAccessToken: pkceData.access_token,
          };
        } catch (pkceError) {
          // PKCE fallback also failed
        }
      }

      return {
        success: false,
        error: errorData?.error || error.message || 'unknown_error',
      };
    }
  }

  /**
   * Normalize Spotify API errors
   */
  private normalizeError(error: any): Error {
    const status = error?.response?.status;
    const data = error?.response?.data;

    const normalized: any = new Error(data?.error?.message || error.message || 'Spotify API error');
    normalized.statusCode = status || 500;
    normalized.code = data?.error?.status || 'SPOTIFY_ERROR';
    normalized.details = data;

    return normalized;
  }
}

// Singleton export
export const spotifyClient = new SpotifyClient();
