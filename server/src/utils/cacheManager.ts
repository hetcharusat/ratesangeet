import NodeCache from 'node-cache';

export interface CacheMetadata {
  source: 'cache' | 'spotify' | 'database' | 'hybrid';
  cachedAt: string; // ISO timestamp
  expiresAt: string; // ISO timestamp
  isFresh: boolean;
  hasMore?: boolean; // Pagination: more results available
  nextCursor?: string | null; // Pagination: cursor for next page
}

export interface CacheEntry<T> {
  data: T;
  metadata: CacheMetadata;
}

export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  hitRate: number;
}

/**
 * Centralized cache manager using NodeCache
 * Provides consistent caching interface across all routes
 */
export class CacheManager {
  private cache: NodeCache;
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor() {
    this.cache = new NodeCache({
      stdTTL: 60, // Default 60 seconds
      checkperiod: 120, // Check for expired keys every 2 minutes
      useClones: false, // Better performance, but be careful with mutations
      deleteOnExpire: true,
    });

    // Log cache events in development
    if (process.env.NODE_ENV !== 'production') {
      this.cache.on('expired', (key) => {
        console.log(`🗑️  Cache expired: ${key}`);
      });
    }
  }

  /**
   * Get value from cache
   * Returns null if not found or expired
   */
  get<T>(key: string): CacheEntry<T> | null {
    const value = this.cache.get<CacheEntry<T>>(key);

    if (value) {
      this.stats.hits++;
      return value;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set value in cache with TTL in seconds
   */
  set<T>(
    key: string,
    data: T,
    ttl: number,
    source: CacheMetadata['source'] = 'cache'
  ): boolean {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    const entry: CacheEntry<T> = {
      data,
      metadata: {
        source,
        cachedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        isFresh: true,
      },
    };

    return this.cache.set(key, entry, ttl);
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete specific key from cache
   */
  delete(key: string): number {
    return this.cache.del(key);
  }

  /**
   * Invalidate all keys matching a pattern
   * Supports wildcards: user:123:* will delete all keys starting with user:123:
   */
  invalidate(pattern: string): number {
    const keys = this.cache.keys();
    let deleted = 0;

    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*') // * becomes .*
      .replace(/\?/g, '.'); // ? becomes .

    const regex = new RegExp(`^${regexPattern}$`);

    for (const key of keys) {
      if (regex.test(key)) {
        this.cache.del(key);
        deleted++;
      }
    }

    if (deleted > 0) {
      console.log(`🗑️  Invalidated ${deleted} cache keys matching: ${pattern}`);
    }

    return deleted;
  }

  /**
   * Invalidate all cache entries for a specific user
   */
  invalidateUser(userId: string): number {
    return this.invalidate(`user:${userId}:*`);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.flushAll();
    console.log('🗑️  Cache cleared completely');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const keys = this.cache.keys();
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      keys: keys.length,
      hitRate: Math.round(hitRate * 100) / 100,
    };
  }

  /**
   * Get all keys in cache
   */
  getKeys(): string[] {
    return this.cache.keys();
  }

  /**
   * Get TTL for a key (seconds remaining)
   */
  getTTL(key: string): number | undefined {
    return this.cache.getTtl(key);
  }

  /**
   * Update TTL for existing key
   */
  updateTTL(key: string, ttl: number): boolean {
    return this.cache.ttl(key, ttl);
  }

  /**
   * Get multiple keys at once
   */
  mget<T>(keys: string[]): Array<CacheEntry<T> | null> {
    return keys.map((key) => this.get<T>(key));
  }
}

/**
 * Cache key builders for consistent naming
 */
export const CacheKeys = {
  // User-specific caches
  userProfile: (userId: string) => `user:${userId}:profile`,
  userStats: (userId: string) => `user:${userId}:stats`,
  userRecentTracks: (userId: string) => `user:${userId}:recent`,
  userAlbumProgress: (userId: string) => `user:${userId}:album-progress`,
  userTopAlbums: (userId: string) => `user:${userId}:top-albums`,
  userTopTracks: (userId: string) => `user:${userId}:top-tracks`,
  userHomeSnapshot: (userId: string) => `user:${userId}:home-snapshot`,

  // Stats caches (cloud summaries)
  albumStats: (userId: string) => `stats:${userId}:albums`,
  trackStats: (userId: string) => `stats:${userId}:tracks`,

  // Spotify API caches
  spotifySearch: (query: string, type: string) => `spotify:search:${type}:${query}`,
  spotifyAlbum: (albumId: string) => `spotify:album:${albumId}`,
  spotifyArtist: (artistId: string) => `spotify:artist:${artistId}`,
  spotifyNewReleases: (country: string) => `spotify:new-releases:${country}`,

  // Discover caches
  discoverFeed: (userId: string) => `discover:${userId}:feed`,
  discoverRecommendations: (userId: string) => `discover:${userId}:recommendations`,
};

/**
 * Cache TTL presets (in seconds)
 */
export const CacheTTL = {
  realtime: 0, // No cache
  veryShort: 15, // 15 seconds
  short: 30, // 30 seconds
  medium: 60, // 1 minute
  long: 300, // 5 minutes
  veryLong: 900, // 15 minutes
  hour: 3600, // 1 hour
  day: 86400, // 24 hours
};

// Singleton export
export const cache = new CacheManager();
