import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getAuth, saveAuth } from '../utils/auth';
import config from '../config';

// Create axios instance for Spotify API calls
const spotifyApi = axios.create({
  baseURL: 'https://api.spotify.com/v1',
  timeout: 10000,
});

// Token refresh logic
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

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

// Simple delay helper
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

// Determine if a request is safe to auto-retry
const isIdempotent = (method?: string) => {
  const m = (method || 'GET').toUpperCase();
  return m === 'GET' || m === 'HEAD' || m === 'OPTIONS';
};

// Exponential backoff with jitter
const backoffWithJitter = (attempt: number, baseMs = 300) => {
  const max = Math.min(2 ** attempt * baseMs, 5000); // cap at 5s
  const jitter = Math.random() * 200; // 0-200ms jitter
  return Math.round(max + jitter);
};

// Request interceptor to add auth token
spotifyApi.interceptors.request.use(
  async (config) => {
    const auth = await getAuth();
    if (auth.accessToken) {
      config.headers['Authorization'] = `Bearer ${auth.accessToken}`;
    }
    // mark retry count on config
    (config as any)._retryCount = (config as any)._retryCount || 0;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for automatic token refresh
spotifyApi.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean; _retryCount?: number });

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Wait for the token to be refreshed
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers['Authorization'] = `Bearer ${token}`;
            }
            return spotifyApi(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const auth = await getAuth();
        
        if (!auth.refreshToken) {
          // No refresh token, user needs to login again
          console.error('[SPOTIFY API] No refresh token available');
          processQueue(new Error('No refresh token'), null);
          isRefreshing = false;
          return Promise.reject(error);
        }

        console.log('[SPOTIFY API] Refreshing access token...');

        // Call refresh endpoint
        const response = await axios.post(`${config.API_URL}/auth/refresh`, {
          refreshToken: auth.refreshToken,
        });

        const responseData = response.data.data || response.data;
        const { accessToken, refreshToken } = responseData;

        if (!accessToken) {
          console.error('[SPOTIFY API] Refresh failed: no access token in response');
          processQueue(new Error('Refresh failed'), null);
          isRefreshing = false;
          return Promise.reject(error);
        }

        console.log('[SPOTIFY API] ✅ Token refreshed successfully');

        // Save new tokens
        await saveAuth({
          accessToken,
          refreshToken: refreshToken || auth.refreshToken,
          user: auth.user,
        });

        // Update header
        if (originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        }

        processQueue(null, accessToken);
        isRefreshing = false;

        // Retry original request
        return spotifyApi(originalRequest);
      } catch (refreshError) {
        console.error('[SPOTIFY API] Token refresh failed:', refreshError);
        processQueue(refreshError, null);
        isRefreshing = false;
        return Promise.reject(refreshError);
      }
    }

    // Auto-retry for transient errors (429, 5xx, network/timeout) on idempotent methods
    const status = error.response?.status;
    const method = originalRequest?.method;
    const attempt = (originalRequest?._retryCount || 0) + 1;
    const maxRetries = 3;

    const is429 = status === 429;
    const is5xx = typeof status === 'number' && status >= 500 && status < 600;
    const isNetwork = !error.response; // DNS/timeout/etc

    if (originalRequest && isIdempotent(method) && attempt <= maxRetries && (is429 || is5xx || isNetwork)) {
      (originalRequest as any)._retryCount = attempt;
      // Respect Retry-After if provided for 429
      let delayMs = 0;
      if (is429) {
        const retryAfterHeader = error.response?.headers?.['retry-after'];
        const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : NaN;
        if (!Number.isNaN(retryAfterSec) && retryAfterSec > 0) {
          delayMs = Math.min(retryAfterSec * 1000, 10000); // cap at 10s
        }
      }
      if (!delayMs) {
        delayMs = backoffWithJitter(attempt);
      }
      // eslint-disable-next-line no-console
      console.warn(`[SPOTIFY API] Retry ${attempt}/${maxRetries} in ${delayMs}ms for ${method?.toUpperCase()} ${originalRequest.url} (status: ${status ?? 'network'})`);
      await sleep(delayMs);
      return spotifyApi(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default spotifyApi;
