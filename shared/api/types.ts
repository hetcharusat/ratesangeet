// Auto-generated minimal SDK types aligned with server/openapi.yaml (transitional envelope)
// Keep in sync with the API spec; update when OpenAPI changes.

export type CacheSource = 'spotify' | 'database' | 'cache' | 'hybrid' | string;

export interface CacheMetadata {
  /** Where the data came from (spotify, database, cache, hybrid) */
  source?: CacheSource;
  /** ISO timestamp when the data was cached */
  cachedAt?: string;
  /** ISO timestamp when the data expires */
  expiresAt?: string;
  /** Indicates the data was computed freshly in this request */
  isFresh?: boolean;
}

export interface Envelope<T = unknown> {
  success: boolean;
  message?: string | null;
  data?: T;
  cache?: CacheMetadata;
  refreshedToken?: string | null;
}

export interface User {
  id?: string; // Mongo ObjectId
  spotifyId?: string;
  displayName?: string;
  email?: string;
  profileImage?: string;
  username?: string;
}

export type ItemType = 'track' | 'album';

export interface Review {
  id?: string;
  userId?: string;
  spotifyId?: string;
  itemType?: ItemType;
  rating?: number;
  text?: string;
  createdAt?: string; // ISO date
}

export interface Scrobble {
  id?: string;
  userId?: string;
  spotifyId?: string;
  trackName?: string;
  artistName?: string;
  albumId?: string | null;
  albumName?: string;
  albumArt?: string | null;
  durationMs?: number;
  playedAt?: string; // ISO date
  source?: string; // e.g., 'spotify'
}

export interface ListeningStats {
  totalMinutes?: number;
  totalScrobbles?: number;
  uniqueArtistsCount?: number | null;
  topAlbums?: Array<{
    name?: string;
    artist?: string;
    albumArt?: string | null;
    count?: number;
    totalTracks?: number | null;
    totalTimeMs?: number | null;
  }>;
  topSingles?: Array<Record<string, unknown>>;
  topGenres?: Array<{ genre?: string; count?: number }>; 
  topArtists?: Array<{ artist?: string; count?: number }>;
  albumCompletions?: {
    totalCompletedAlbums?: number;
    totalCompletedAlbumPlays?: number;
    recentCompletions?: Array<{
      albumName?: string;
      artistName?: string;
      albumArt?: string | null;
      lastCompletedAt?: string; // ISO date
    }>;
    dailyCompletionTrend?: Array<{ date?: string; count?: number }>;
    last7DaysCompletions?: number;
    currentStreak?: number;
  };
}

// Common response shapes
export type HealthResponse = Envelope<{ status?: string; message?: string }>; 
export type LoginResponse = Envelope<{ url: string; target?: string; redirectUri?: string }>;
export type CallbackResponse = Envelope<{ accessToken: string; refreshToken: string; user: User }>;
export type PkceLoginResponse = Envelope<{ accessToken: string; refreshToken: string; user: User }>;
export type RefreshResponse = Envelope<{ accessToken: string; refreshToken?: string | null }>;

// Music
export type ScrobblesResponse = Scrobble[]; // transitional: this endpoint returns a raw array
export type ListeningStatsResponse = ListeningStats; // per spec
export type ScrobbleResponse = Envelope<{ scrobbled: boolean; scrobble?: Scrobble }>;
export type SyncRecentResponse = Envelope<{ message?: string }>;
export type SearchResponse = Envelope<{ albums?: unknown; tracks?: unknown; artists?: unknown }>;
export type RecentlyPlayedResponse = Envelope<{ items: unknown[] }>;
export type CurrentlyPlayingResponse = Envelope<{ isPlaying?: boolean; track?: unknown; progressMs?: number; timestamp?: number }>;

// Reviews
export type ReviewsByUserResponse = Envelope<{ reviews: Review[] }>;
export type CreateReviewResponse = Envelope<{ review: Review }>;

// Users
export type GetUserResponse = Envelope<User>;

// Home
export interface HomeSnapshot {
  user?: User;
  recentActivity?: {
    scrobbles?: Scrobble[];
    count?: number;
  };
  stats?: {
    totalScrobbles?: number;
    uniqueAlbums?: number;
    uniqueTracks?: number;
  };
  topContent?: {
    albums?: Array<Record<string, unknown>>;
    tracks?: Array<Record<string, unknown>>;
  };
  albumProgress?: Array<Record<string, unknown>>;
  meta?: Record<string, unknown>;
  cache?: CacheMetadata;
}
export type HomeSnapshotResponse = HomeSnapshot; // per spec this one is not enveloped
export type QuickStatsResponse = { totalScrobbles?: number; uniqueAlbums?: number; uniqueTracks?: number; cache?: CacheMetadata };

// Refresh
export type RecentRefreshResponse = Envelope<{ items: unknown[]; cache?: CacheMetadata; refreshedToken?: string | null }>;
export type InvalidationResponse = { message?: string; cache?: CacheMetadata };
export type CacheStatsResponse = Record<string, unknown>;
