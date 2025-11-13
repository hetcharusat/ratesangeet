import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import config from '../config';
import { getAuth, saveAuth } from '../utils/auth';

const api = axios.create({
  baseURL: config.API_URL,
  timeout: 30000, // Increased to 30 seconds for slower connections
});

// Request interceptor - attach Authorization header automatically
api.interceptors.request.use(
  async (config) => {
    const auth = await getAuth();
    if (auth?.accessToken && config.headers) {
      config.headers['Authorization'] = `Bearer ${auth.accessToken}`;
    }
    // Provide stable identity to server auth middleware so it doesn't depend on DB-stored accessToken
    if (auth?.user?.id && config.headers) {
      config.headers['x-user-id'] = auth.user.id;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Token refresh logic
let isRefreshing = false;
/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];
/* eslint-enable no-unused-vars, @typescript-eslint/no-unused-vars */

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

// Response interceptor for automatic token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Wait for the token to be refreshed
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const auth = await getAuth();

        if (!auth.user?.id && !auth.refreshToken) {
          processQueue(new Error('No user or refresh token'), null);
          return Promise.reject(error);
        }

        // Preferred: PKCE refresh updates server-side user tokens to keep Bearer and DB in sync
        let accessToken: string | null = null;
        let newRefresh: string | null = null;
        try {
          if (auth.user?.id) {
            const pkce = await axios.post(`${config.API_URL}/auth/pkce-refresh`, {
              userId: auth.user.id,
            });
            const data = pkce.data.data || pkce.data;
            accessToken = data.accessToken || data.access_token || null;
            newRefresh = data.refreshToken || data.refresh_token || null;
          }
        } catch {
          // Fallback to legacy /auth/refresh with client secret flow when PKCE path is unavailable
          if (auth.refreshToken) {
            const legacy = await axios.post(`${config.API_URL}/auth/refresh`, {
              refreshToken: auth.refreshToken,
            });
            const data = legacy.data.data || legacy.data;
            accessToken = data.accessToken || data.access_token || null;
            newRefresh = data.refreshToken || data.refresh_token || null;
          }
        }

        if (!accessToken) {
          processQueue(new Error('Failed to refresh token'), null);
          isRefreshing = false;
          return Promise.reject(error);
        }

        // Save new tokens (preserve existing refresh if none returned)
        await saveAuth({
          accessToken,
          refreshToken: newRefresh || auth.refreshToken,
          user: auth.user,
        });

        // Update headers on the original request
        if (originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
          if (auth.user?.id) originalRequest.headers['x-user-id'] = auth.user.id;
        }

        processQueue(null, accessToken);
        isRefreshing = false;

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export interface SpotifyImage {
  url: string;
}

export interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: SpotifyImage[];
  };
  duration_ms?: number;
}

export interface Review {
  _id: string;
  userId:
    | string
    | {
        _id: string;
        displayName: string;
        profileImage?: string;
      };
  itemType: 'track' | 'album';
  spotifyId: string;
  itemName: string;
  artistName: string;
  albumArt?: string;
  rating: number;
  reviewText?: string;
  isPublic: boolean;
  likes: number;
  reactionsCount?: Record<string, number>;
  userReaction?: string | null;
  listeningDate: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ReviewPayload {
  userId?: string;
  itemType: 'track' | 'album';
  spotifyId: string;
  itemName: string;
  artistName: string;
  albumArt?: string;
  rating: number;
  reviewText?: string;
  isPublic?: boolean;
  listeningDate?: string;
}

export interface ReviewComment {
  _id: string;
  reviewId: string;
  userId:
    | string
    | {
        _id: string;
        displayName: string;
        profileImage?: string;
        username?: string;
      };
  text: string;
  parentId?: string | null;
  createdAt: string;
}

export interface CurrentlyPlayingResponse {
  isPlaying: boolean;
  track?: Track;
  progressMs?: number;
  timestamp?: number;
}

export interface Scrobble {
  _id: string;
  userId: string;
  spotifyId: string;
  trackName: string;
  artistName: string;
  albumName?: string;
  albumId?: string;
  albumArt?: string;
  durationMs?: number;
  playedAt: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

// Auth APIs
export const getSpotifyLoginUrl = async () => {
  const response = await api.get('/auth/login');
  return response.data.url;
};

export const handleSpotifyCallback = async (code: string, redirectUri?: string, codeVerifier?: string) => {
  const response = await api.post('/auth/callback', { code, redirectUri, codeVerifier });
  return response.data;
};

// PKCE-based login: send tokens to backend for user upsert
export const pkceLogin = async (accessToken: string, refreshToken?: string) => {
  const response = await api.post('/auth/pkce-login', { accessToken, refreshToken });
  return response.data as {
    accessToken: string;
    refreshToken?: string;
    user: {
      id: string;
      spotifyId: string;
      displayName: string;
      email: string;
      profileImage?: string;
      username?: string;
    };
  };
};

export const refreshAccessToken = async (
  refreshToken: string
): Promise<{ accessToken: string; refreshToken?: string }> => {
  // Perform PKCE-compatible refresh directly with Spotify (no client secret)
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: (config as any).SPOTIFY_CLIENT_ID,
  });
  const response = await axios.post('https://accounts.spotify.com/api/token', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const data = response.data as any;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token, // may be undefined if Spotify didn't return a new one
  };
};

// Music APIs
export const getRecentTracks = async (accessToken: string) => {
  const response = await api.get('/music/recent', {
    params: { accessToken },
  });
  return response.data;
};

export const getTopTracks = async (accessToken: string, timeRange: string = 'medium_term') => {
  const response = await api.get('/music/top-tracks', {
    params: { accessToken, timeRange },
  });
  return response.data;
};

export const searchMusic = async (accessToken: string, query: string, types: string = 'track,album') => {
  const response = await api.get('/music/search', {
    params: { accessToken, q: query, type: types },
  });
  return response.data;
};

export const getAlbumDetails = async (accessToken: string, albumId: string) => {
  const response = await api.get('/music/album', {
    params: { accessToken, albumId },
  });
  return response.data;
};

export interface ArtistProfile {
  artist: { id: string; name: string; images?: SpotifyImage[] } | null;
  topTracks: Array<{
    id: string; name: string; duration_ms?: number; popularity?: number; preview_url?: string;
    album?: { id?: string; name?: string; images?: SpotifyImage[] };
    artists?: { id?: string; name: string }[];
  }>;
  discography: {
    albums: Array<{ id: string; name: string; images?: SpotifyImage[]; release_date?: string }>;
    singles: Array<{ id: string; name: string; images?: SpotifyImage[]; release_date?: string }>;
    compilations: Array<{ id: string; name: string; images?: SpotifyImage[]; release_date?: string }>;
  };
}

export const getArtistProfile = async (
  accessToken: string,
  opts: { artistId?: string; q?: string; market?: string }
): Promise<ArtistProfile> => {
  const response = await api.get('/music/artist', {
    params: { accessToken, ...opts },
  });
  return response.data as ArtistProfile;
};

export const getCurrentlyPlaying = async (accessToken: string): Promise<CurrentlyPlayingResponse> => {
  const response = await api.get('/music/currently-playing', {
    params: { accessToken },
  });
  return response.data;
};

export const scrobbleCurrentTrack = async (accessToken: string, userId: string) => {
  const response = await api.post('/music/scrobble', {
    accessToken,
    userId,
  });
  return response.data as { scrobbled: boolean; scrobble?: Scrobble; message?: string };
};

// Sync recently played from Spotify to backfill scrobbles (app could be closed)
export const syncRecentPlays = async (accessToken: string, userId: string) => {
  const response = await api.post('/music/sync-recent', { accessToken, userId });
  return response.data as {
    success: boolean;
    inserted: number;
    checked: number;
    pages?: number;
    startAfter?: number | null;
    endAfter?: number | null;
    items?: Array<{
      spotifyId: string;
      trackName: string;
      artistName: string;
      albumId?: string;
      albumName?: string;
      albumArt?: string;
      durationMs?: number;
      playedAt: string; // iso
    }>;
  };
};

export const getUserScrobbles = async (userId: string, limit: number = 50): Promise<Scrobble[]> => {
  const response = await api.get('/music/scrobbles', {
    params: { userId, limit },
  });
  return response.data;
};

export interface ListeningStats {
  totalMinutes: number;
  totalScrobbles: number;
  uniqueArtistsCount?: number;
  topAlbums: Array<{
    name: string;
    artist: string;
    albumArt?: string;
    count: number;
    totalTracks?: number;
    totalTimeMs?: number;
  }>;
  topSingles?: Array<{
    name: string;
    artist: string;
    albumArt?: string;
    count: number;
    totalTracks?: number;
  }>;
  topGenres: Array<{
    genre: string;
    count: number;
  }>;
  topArtists?: Array<{
    artist: string;
    count: number;
  }>;
  albumCompletions?: {
    totalCompletedAlbums: number;
    totalCompletedAlbumPlays?: number;
    recentCompletions: Array<{
      albumName?: string;
      artistName?: string;
      albumArt?: string;
      completedPlays?: number;
      lastCompletedAt?: string;
    }>;
    dailyCompletionTrend: Array<{ date: string; count: number }>;
    last7DaysCompletions?: number;
    currentStreak?: number;
  };
}

export const getListeningStats = async (
  userId: string,
  accessToken?: string,
  opts?: { force?: boolean }
): Promise<ListeningStats & { cache?: { hit: boolean; ageMs: number; generatedAt: number; lastScrobblePlayedAt?: number; forced?: boolean } }> => {
  const response = await api.get('/music/listening-stats', {
    params: { userId, accessToken, force: opts?.force ? 1 : undefined },
  });
  return response.data;
};

// Review APIs
export const createReview = async (reviewData: ReviewPayload) => {
  const response = await api.post('/reviews', reviewData);
  return response.data;
};

export const getPublicReviews = async (limit: number = 50, skip: number = 0) => {
  const response = await api.get('/reviews/public', {
    params: { limit, skip },
  });
  return response.data;
};

export const getUserReviews = async (userId: string) => {
  const response = await api.get(`/reviews/user/${userId}`);
  return response.data;
};

export const getTrackReviews = async (spotifyId: string) => {
  const response = await api.get(`/reviews/track/${spotifyId}`);
  return response.data;
};

export const updateReview = async (reviewId: string, reviewData: Partial<Review>) => {
  const response = await api.put(`/reviews/${reviewId}`, reviewData);
  return response.data;
};

export const deleteReview = async (reviewId: string) => {
  const response = await api.delete(`/reviews/${reviewId}`);
  return response.data;
};

export const getUserStats = async (userId: string) => {
  const response = await api.get(`/reviews/stats/${userId}`);
  return response.data;
};

// User Search APIs
export const searchUsers = async (query: string, limit: number = 20) => {
  const response = await api.get('/auth/search-users', {
    params: { query, limit },
  });
  return response.data;
};

// Follow system APIs
export const getUserProfile = async (userId: string, viewerId?: string) => {
  const response = await api.get(`/users/${userId}`, {
    params: { viewerId },
  });
  return response.data;
};

export const followUser = async (targetUserId: string, followerUserId: string) => {
  const response = await api.post(`/users/${targetUserId}/follow`, { followerId: followerUserId });
  return response.data;
};

export const unfollowUser = async (targetUserId: string, followerUserId: string) => {
  const response = await api.post(`/users/${targetUserId}/unfollow`, { followerId: followerUserId });
  return response.data;
};

// Friends activity feed
export const getFriendsFeed = async (
  viewerUserId: string,
  limit: number = 50,
  skip: number = 0
): Promise<Review[]> => {
  const response = await api.get(`/users/${viewerUserId}/feed`, { params: { limit, skip } });
  return response.data;
};

// Comments & Reactions APIs (Updated with threading support)
export interface Comment {
  _id: string;
  reviewId: string;
  userId: string;
  username?: string;
  text: string;
  parentId?: string | null;
  depth: number;
  replyCount: number;
  reactionsCount?: Record<string, number>;
  reactionsByUser?: Record<string, string>;
  createdAt: string;
  replies?: Comment[];
}

export const getReviewComments = async (reviewId: string): Promise<Comment[]> => {
  const response = await api.get(`/comments/${reviewId}`);
  return response.data.comments as Comment[];
};

export const addReviewComment = async (
  reviewId: string,
  userId: string,
  text: string,
  parentId?: string | null
): Promise<Comment> => {
  const response = await api.post('/comments', { reviewId, userId, text, parentId });
  return response.data.comment as Comment;
};

export const deleteReviewComment = async (commentId: string, userId: string) => {
  const response = await api.delete(`/comments/${commentId}`, { data: { userId } });
  return response.data;
};

export const reactToComment = async (commentId: string, userId: string, reactionType: string) => {
  const response = await api.post(`/comments/${commentId}/react`, { userId, reactionType });
  return response.data.comment as Comment;
};

// React to a review (emoji reactions - single-select)
export const reactToReview = async (reviewId: string, userId: string, reactionType: string) => {
  const response = await api.post(`/reviews/${reviewId}/react`, { userId, type: reactionType });
  
  // Server returns { success, reviewId, reactionsCount, userReaction, likes }
  // Convert to partial Review object for local update
  return {
    reactionsCount: response.data.reactionsCount,
    userReaction: response.data.userReaction,
    likes: response.data.likes,
  } as Partial<Review>;
};

// Get users who reacted to a review (for showing like/dislike lists)
export const getReviewReactionUsers = async (reviewId: string, reactionType?: string) => {
  const params = reactionType ? { type: reactionType } : {};
  const response = await api.get(`/reviews/${reviewId}/reactions/users`, { params });
  return response.data.users as Array<{
    _id: string;
    displayName: string;
    profileImage?: string;
    username?: string;
    spotifyId: string;
    reactionType: string;
  }>;
};

// Profile updates
export const updateUsername = async (userId: string, username: string) => {
  const response = await api.put(`/users/${userId}/username`, { username });
  return response.data as { success: true; username: string };
};

type FavItem = { id: string; name: string; artist: string; image?: string };
export const updateFavorites = async (
  userId: string,
  favAlbums?: FavItem[],
  favTracks?: FavItem[]
) => {
  const response = await api.put(`/users/${userId}/favorites`, { favAlbums, favTracks });
  return response.data as { success: true; favAlbums: FavItem[]; favTracks: FavItem[] };
};

export default api;

// ===== Discovery Endpoint =====
export interface DiscoveryPayload {
  // === PERSONALIZED SECTIONS ===
  madeForYou?: {
    title: string;
    description: string;
    playlists: Array<{
      playlistId: string;
      playlistName: string;
      description: string;
      coverArt?: string;
      owner: string;
      totalTracks: number;
      spotifyUri: string;
      spotifyUrl: string;
    }>;
  };
  recommendations?: {
    title: string;
    description: string;
    tracks: Array<{
      trackId: string;
      trackName: string;
      artistName: string;
      albumName: string;
      albumId: string;
      albumArt?: string;
      previewUrl?: string;
      spotifyUri: string;
      spotifyUrl: string;
      popularity: number;
    }>;
  };
  newReleases?: {
    title: string;
    description: string;
    albums: Array<{
      albumId: string;
      albumName: string;
      artistName: string;
      albumArt?: string;
      releaseDate: string;
      totalTracks: number;
      spotifyUri: string;
      spotifyUrl: string;
    }>;
  };
  
  // === GLOBAL TRENDING SECTIONS ===
  trendingAlbums?: {
    title: string;
    description: string;
    albums: Array<{
      rank: number;
      albumId: string;
      albumName: string;
      artistName: string;
      albumArt?: string;
      releaseDate: string;
      totalTracks: number;
      popularity?: number;
      spotifyUri: string;
      spotifyUrl: string;
    }>;
  };
  trendingTracks?: {
    title: string;
    description: string;
    tracks: Array<{
      rank: number;
      trackId: string;
      trackName: string;
      artistName: string;
      albumName: string;
      albumId: string;
      albumArt?: string;
      previewUrl?: string;
      spotifyUri: string;
      spotifyUrl: string;
      popularity: number;
    }>;
  };
  viral50?: {
    title: string;
    description: string;
    tracks: Array<{
      rank: number;
      trackId: string;
      trackName: string;
      artistName: string;
      albumName: string;
      albumId: string;
      albumArt?: string;
      previewUrl?: string;
      spotifyUri: string;
      spotifyUrl: string;
      popularity: number;
    }>;
  };
  
  // === OTHER SECTIONS ===
  featuredPlaylists?: {
    title: string;
    description: string;
    playlists: Array<{
      playlistId: string;
      playlistName: string;
      description: string;
      coverArt?: string;
      owner: string;
      totalTracks: number;
      spotifyUri: string;
      spotifyUrl: string;
    }>;
  };
  communityReviews?: {
    title: string;
    description: string;
    reviews: Review[];
  };
  
  generatedAt: string;
  region?: string;
  source?: string;
  cached?: boolean;
  cacheAge?: number;
}

export const getDiscoveryData = async (accessToken?: string): Promise<DiscoveryPayload> => {
  const params = accessToken ? { accessToken } : {};
  const response = await api.get('/discover', { params });
  return response.data as DiscoveryPayload;
};

// ===== Hybrid storage stats (album summaries) =====
export type AlbumStats = {
  userId: string;
  albumId: string;
  albumName?: string;
  artistName?: string;
  albumArt?: string;
  playCount: number;
  lastPlayedAt?: string;
  totalTracks?: number;
  completedPlays?: number;
  lastCompletedAt?: string;
};

export const upsertAlbumStatsBatch = async (
  userId: string,
  albums: Array<{ albumId: string; albumName?: string; artistName?: string; albumArt?: string; deltaCount: number; lastPlayedAt?: number }>
) => {
  const response = await api.post('/stats/album-batch-upsert', { userId, albums });
  return response.data as { success: boolean; matched: number; modified: number; upserted: number };
};

export const getAlbumStats = async (userId: string, limit: number = 50): Promise<AlbumStats[]> => {
  const response = await api.get(`/stats/album/${userId}`, { params: { limit } });
  return response.data as AlbumStats[];
};

// Track stats (per-user track play counts)
export type TrackStats = {
  userId: string;
  trackId?: string;
  trackKey: string;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  albumArt?: string;
  playCount: number;
  lastPlayedAt?: string;
};

export const upsertTrackStatsBatch = async (
  userId: string,
  tracks: Array<{ trackId?: string; trackName?: string; artistName?: string; albumName?: string; albumArt?: string; deltaCount: number; lastPlayedAt?: number }>
) => {
  const response = await api.post('/stats/track-batch-upsert', { userId, tracks });
  return response.data as { success: boolean; matched: number; modified: number; upserted: number };
};

export const getTrackStats = async (userId: string, limit: number = 50): Promise<TrackStats[]> => {
  const response = await api.get(`/stats/track/${userId}`, { params: { limit } });
  return response.data as TrackStats[];
};

// New Profile APIs
export interface UserSearchResult {
  _id: string;
  username?: string;
  displayName: string;
  profileImage?: string;
  followersCount: number;
  followingCount: number;
}

export interface UserSearchResponse {
  results: UserSearchResult[];
  page: number;
  totalPages: number;
  totalCount: number;
  hasMore: boolean;
}

export const searchUsersOptimized = async (query: string, page: number = 1, limit: number = 20): Promise<UserSearchResponse> => {
  const response = await api.get('/users', {
    params: { query, page, limit },
  });
  return response.data;
};

export interface UserActivity {
  lastScrobble: {
    trackName: string;
    artistName: string;
    albumArt?: string;
    playedAt: string;
    spotifyId?: string;
  } | null;
  recentReviews: Array<{
    _id: string;
    itemType: 'track' | 'album';
    spotifyId: string;
    itemName: string;
    artistName: string;
    albumArt?: string;
    rating: number;
    reviewText?: string;
    createdAt: string;
    likes: number;
  }>;
}

export const getUserActivity = async (userId: string, reviewLimit: number = 5): Promise<UserActivity> => {
  const response = await api.get(`/users/${userId}/activity`, {
    params: { reviewLimit },
  });
  return response.data;
};

export interface MutualFollower {
  _id: string;
  username?: string;
  displayName: string;
  profileImage?: string;
}

export interface MutualFollowersResponse {
  mutualFollowers: MutualFollower[];
  count: number;
}

export const getMutualFollowers = async (userId: string, viewerId: string): Promise<MutualFollowersResponse> => {
  const response = await api.get(`/users/${userId}/mutual-followers`, {
    params: { viewerId },
  });
  return response.data;
};

export interface SimpleUser {
  _id: string;
  displayName: string;
  username?: string;
  profileImage?: string;
}

export const getFollowers = async (userId: string, limit: number = 50): Promise<{ followers: SimpleUser[]; count: number }> => {
  const response = await api.get(`/users/${userId}/followers`, { params: { limit } });
  return response.data as { followers: SimpleUser[]; count: number };
};

export const getFollowing = async (userId: string, limit: number = 50): Promise<{ following: SimpleUser[]; count: number }> => {
  const response = await api.get(`/users/${userId}/following`, { params: { limit } });
  return response.data as { following: SimpleUser[]; count: number };
};

export const updateUserProfile = async (
  userId: string,
  data: {
    bio?: string;
    instagramUsername?: string;
    twitterHandle?: string;
    location?: string;
  }
) => {
  const response = await api.put(`/users/${userId}/profile`, data);
  return response.data;
};

// ===== V2 API Endpoints (Minimal Payloads) =====

export interface V2Album {
  id?: string;
  name: string;
  artistName?: string;
  totalTracks?: number;
  imageSmall?: string;
}

export interface V2Track {
  id?: string;
  name: string;
  albumId?: string;
  albumName?: string;
  artistName?: string;
  durationMs?: number;
}

export interface V2Scrobble {
  spotifyId: string;
  trackName: string;
  artistName: string;
  albumId?: string;
  albumName?: string;
  albumArt?: string;
  durationMs?: number;
  playedAt: string; // ISO
}

export interface V2SummaryStats {
  totalMinutes?: number;
  totalScrobbles?: number;
  uniqueArtistsCount?: number;
}

export async function getV2Album(id: string) {
  const res = await api.get(`/v2/album/${id}`);
  return res.data as V2Album;
}

export async function getV2Track(id: string) {
  const res = await api.get(`/v2/track/${id}`);
  return res.data as V2Track;
}

export async function getV2SummaryStats() {
  const res = await api.get('/v2/stats/summary');
  return res.data as V2SummaryStats;
}

export async function getV2TopAlbums(limit: number = 10) {
  const res = await api.get('/v2/stats/top-albums', { params: { limit } });
  return (res.data || []) as Array<{ albumId?: string; name: string; artist: string; albumArt?: string; count: number }>;
}

export async function getV2RecentScrobbles(limit: number = 50) {
  const res = await api.get('/v2/scrobbles/recent', { params: { limit } });
  return (res.data?.scrobbles || []) as V2Scrobble[];
}

// Filter recent scrobbles for an album (by id OR fallback name)
export async function getV2AlbumScrobbles(albumIdOrName: string, limit: number = 200) {
  const scrobbles = await getV2RecentScrobbles(limit);
  return scrobbles.filter(s => s.albumId === albumIdOrName || s.albumName === albumIdOrName);
}

// Derive album progress from scrobbles and totalTracks
export function computeAlbumProgress(scrobbles: V2Scrobble[], totalTracks?: number) {
  if (!totalTracks || totalTracks < 4) return { percent: 0, uniqueCount: 0 };
  const uniq = new Set(scrobbles.map(s => s.spotifyId || `${s.trackName}|${s.artistName}`));
  const percent = Math.min(100, (uniq.size / totalTracks) * 100);
  return { percent, uniqueCount: uniq.size };
}
