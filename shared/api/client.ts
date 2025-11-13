/* Minimal fetch-based API client for Ratesangeet API
 * This wrapper is intentionally light and typed with the minimal interfaces in ./types
 */
import type {
  HealthResponse,
  LoginResponse,
  CallbackResponse,
  PkceLoginResponse,
  RefreshResponse,
  ScrobblesResponse,
  ListeningStatsResponse,
  ScrobbleResponse,
  SyncRecentResponse,
  SearchResponse,
  RecentlyPlayedResponse,
  CurrentlyPlayingResponse,
  ReviewsByUserResponse,
  CreateReviewResponse,
  GetUserResponse,
  HomeSnapshotResponse,
  QuickStatsResponse,
  RecentRefreshResponse,
  InvalidationResponse,
} from './types';

export interface ApiClientOptions {
  baseUrl: string; // e.g., http://localhost:5000 or https://ratesangeet.onrender.com
  headers?: Record<string, string>;
}

export class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(opts: ApiClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'X-API-Envelope': 'transitional-v1',
      ...(opts.headers || {}),
    };
  }

  private buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>) {
    const url = new URL(this.baseUrl + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown, query?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const res = await fetch(this.buildUrl(path, query), {
      method,
      headers: this.defaultHeaders,
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      const message = (json && (json.message || json.error || json.reason)) || `HTTP ${res.status}`;
      throw new Error(message);
    }
    return json as T;
  }

  // System
  health() {
    return this.request<HealthResponse>('GET', '/api/health');
  }

  // Auth
  authLogin(target?: 'mobile' | 'web') {
    return this.request<LoginResponse>('GET', '/api/auth/login', undefined, { target });
  }
  authCallback(payload: { code: string; redirectUri: string; codeVerifier: string; target?: string }) {
    return this.request<CallbackResponse>('POST', '/api/auth/callback', payload);
  }
  authPkceLogin(payload: { accessToken: string; refreshToken: string }) {
    return this.request<PkceLoginResponse>('POST', '/api/auth/pkce-login', payload);
  }
  authRefresh(payload: { refreshToken: string }) {
    return this.request<RefreshResponse>('POST', '/api/auth/refresh', payload);
  }

  // Music
  scrobbles(query: { userId: string; limit?: number }) {
    return this.request<ScrobblesResponse>('GET', '/api/music/scrobbles', undefined, query);
  }
  listeningStats(query: { userId: string; accessToken?: string; force?: boolean }) {
    return this.request<ListeningStatsResponse>('GET', '/api/music/listening-stats', undefined, query);
  }
  scrobble(payload: { accessToken: string; userId: string }) {
    return this.request<ScrobbleResponse>('POST', '/api/music/scrobble', payload);
  }
  syncRecent(payload: { accessToken: string; userId: string }) {
    return this.request<SyncRecentResponse>('POST', '/api/music/sync-recent', payload);
  }
  search(query: { q: string; type?: string; userId?: string; accessToken?: string; force?: boolean }) {
    return this.request<SearchResponse>('GET', '/api/music/search', undefined, query);
  }
  recentlyPlayed(query: { userId?: string; accessToken?: string; limit?: number; force?: boolean }) {
    return this.request<RecentlyPlayedResponse>('GET', '/api/music/recently-played', undefined, query);
  }
  currentlyPlaying(query: { userId?: string; accessToken?: string }) {
    return this.request<CurrentlyPlayingResponse>('GET', '/api/music/currently-playing', undefined, query);
  }

  // Reviews
  reviewsByUser(userId: string) {
    return this.request<ReviewsByUserResponse>('GET', `/api/reviews/user/${encodeURIComponent(userId)}`);
  }
  createReview(payload: { userId: string; spotifyId: string; itemType: 'track' | 'album'; rating: number; text?: string }) {
    return this.request<CreateReviewResponse>('POST', '/api/reviews', payload);
  }

  // Users
  getUser(id: string) {
    return this.request<GetUserResponse>('GET', `/api/users/${encodeURIComponent(id)}`);
  }

  // Home
  homeSnapshot(query: { userId: string; force?: boolean }) {
    return this.request<HomeSnapshotResponse>('GET', '/api/home/snapshot', undefined, query);
  }
  homeQuickStats(query: { userId: string }) {
    return this.request<QuickStatsResponse>('GET', '/api/home/quick-stats', undefined, query);
  }

  // Refresh
  refreshRecent(payload: { userId: string }) {
    return this.request<RecentRefreshResponse>('POST', '/api/refresh/recent', payload);
  }
  refreshStats(payload: { userId: string }) {
    return this.request<InvalidationResponse>('POST', '/api/refresh/stats', payload);
  }
  refreshDiscover(payload: { userId: string }) {
    return this.request<unknown>('POST', '/api/refresh/discover', payload);
  }
  refreshHome(payload: { userId: string }) {
    return this.request<unknown>('POST', '/api/refresh/home', payload);
  }
  refreshAll(payload: { userId: string }) {
    return this.request<unknown>('POST', '/api/refresh/all', payload);
  }
  cacheStats() {
    return this.request<Record<string, unknown>>('GET', '/api/refresh/cache-stats');
  }
}

export default ApiClient;
