import { Response } from 'express';
import { CacheMetadata } from './cacheManager';

export interface ApiSuccess<T = any> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  details?: any;
}

/**
 * Response with cache metadata for cached endpoints
 */
export interface CachedApiSuccess<T = any> {
  success: true;
  data: T;
  cache: CacheMetadata;
  refreshedToken?: string; // If Spotify token was rotated
}

export type ApiResponse<T = any> = ApiSuccess<T> | ApiError;
export type CachedApiResponse<T = any> = CachedApiSuccess<T> | ApiError;

export function success<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ success: true, data } as ApiSuccess<T>);
}

export function error(res: Response, message: string, status = 500, details?: any): void {
  res.status(status).json({ success: false, error: message, details } as ApiError);
}

/**
 * Send cached response with metadata
 */
export function cachedSuccess<T>(
  res: Response,
  data: T,
  cacheMetadata: CacheMetadata,
  refreshedToken?: string,
  status = 200
): void {
  const response: CachedApiSuccess<T> = {
    success: true,
    data,
    cache: cacheMetadata,
  };

  if (refreshedToken) {
    response.refreshedToken = refreshedToken;
  }

  res.status(status).json(response);
}

/**
 * Transitional response wrapper for migrating legacy routes.
 * Returns unified envelope AND preserves the original top-level payload fields
 * so existing clients expecting raw shapes don't break immediately.
 * Migration plan:
 *  - Phase A: Use transitionalSuccess
 *  - Phase B: Client updates to read `data`
 *  - Phase C: Replace with `success` / `cachedSuccess` only
 */
export function transitionalSuccess<T extends Record<string, any>>(
  res: Response,
  payload: T,
  options: { cache?: CacheMetadata; refreshedToken?: string; status?: number } = {}
): void {
  const { cache, refreshedToken, status = 200 } = options;
  const base: any = { success: true, data: payload };
  // Duplicate original fields at root (except ones that would collide)
  for (const [k, v] of Object.entries(payload)) {
    if (!(k in base)) base[k] = v;
  }
  if (cache) base.cache = cache;
  if (refreshedToken) base.refreshedToken = refreshedToken;
  res.status(status).json(base);
}
