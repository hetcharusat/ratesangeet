import type { paths } from './api-types';

// Basic fetch wrapper enforcing success/error shape
export interface ApiResponse<T> { success: boolean; data?: T; error?: string; }

// Derive base URL in browser/React Native or Node
const DEFAULT_BASE = (globalThis as any).EXPO_PUBLIC_API_URL
  || (globalThis as any).API_BASE_URL
  || 'http://localhost:5000';

function buildUrl(path: string, params?: Record<string, any>) {
  if (!params || Object.keys(params).length === 0) return `${DEFAULT_BASE}${path}`;
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    usp.set(k, String(v));
  });
  return `${DEFAULT_BASE}${path}?${usp.toString()}`;
}

async function request<T>(method: string, path: string, opts: { query?: Record<string, any>; body?: any; headers?: Record<string,string> } = {}): Promise<ApiResponse<T>> {
  try {
    const url = buildUrl(path, opts.query);
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(opts.headers||{}) },
      body: method === 'GET' ? undefined : JSON.stringify(opts.body || {})
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: json.error || res.statusText };
    }
    // If backend not yet standardized, wrap raw response
    if (json && typeof json.success === 'boolean') return json as ApiResponse<T>;
    return { success: true, data: json as T };
  } catch (e: any) {
    return { success: false, error: e.message || 'Network error' };
  }
}

// Specific helpers (sample subset)
export const api = {
  auth: {
    login: (target?: 'mobile'|'web') => request<unknown>('GET', '/api/auth/login', { query: { target } }),
    callback: (payload: { code: string; redirectUri?: string; codeVerifier?: string; target?: string }) => request('POST','/api/auth/callback',{ body: payload }),
    pkceLogin: (payload: { accessToken: string; refreshToken?: string }) => request('POST','/api/auth/pkce-login',{ body: payload }),
    refresh: (refreshToken: string) => request<{ accessToken: string; refreshToken?: string }>('POST','/api/auth/refresh',{ body: { refreshToken } }),
  },
  music: {
    search: (accessToken: string, q: string) => request('GET','/api/music/search',{ query: { accessToken, q } }),
    artist: (query: { accessToken: string; artistId?: string; q?: string }) => request('GET','/api/music/artist',{ query }),
    album: (accessToken: string, albumId: string) => request('GET','/api/music/album',{ query: { accessToken, albumId } }),
    currentlyPlaying: (accessToken: string) => request('GET','/api/music/currently-playing',{ query: { accessToken } }),
    listeningStats: (query: { userId: string; accessToken?: string; force?: boolean }) => request('GET','/api/music/listening-stats',{ query }),
    scrobble: (payload: { accessToken: string; userId: string }) => request('POST','/api/music/scrobble',{ body: payload }),
    syncRecent: (payload: { accessToken: string; userId: string }) => request('POST','/api/music/sync-recent',{ body: payload }),
  },
  reviews: {
    create: (review: { userId: string; spotifyId: string; itemType: 'track'|'album'; rating: number; text: string }) => request('POST','/api/reviews',{ body: review }),
    byUser: (userId: string) => request('GET',`/api/reviews/user/${userId}`),
  },
  users: {
    profile: (id: string) => request('GET',`/api/users/${id}`),
  }
};

export type ApiPaths = paths;
