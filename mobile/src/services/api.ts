import axios from 'axios';
import config from '../config';

const api = axios.create({
  baseURL: config.API_URL,
  timeout: 10000,
});

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
