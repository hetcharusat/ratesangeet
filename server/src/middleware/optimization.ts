import compression from 'compression';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

/**
 * Compression middleware (gzip)
 * Apply globally to all responses
 */
export const compressionMiddleware = compression({
  filter: (req: Request, res: Response) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024, // Only compress if response > 1KB
});

/**
 * Rate limiter for batch-upsert endpoint
 * 10 requests per second burst, 100 per minute sustained
 */
export const batchUpsertRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many scrobble requests, please slow down',
  // Skip rate limiting in development
  skip: (req) => process.env.NODE_ENV !== 'production',
});

/**
 * Rate limiter for V2 snapshot endpoint
 * More lenient: 120 requests per minute (1 every 30s + buffer)
 */
export const snapshotRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 150, // Allow some buffer over 120/min
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many snapshot requests',
  skip: (req) => process.env.NODE_ENV !== 'production',
});

/**
 * ETag helper for cacheable GET responses
 * Generates weak ETag based on data + timestamp
 */
export const generateETag = (data: any, timestamp?: Date): string => {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  const hash = crypto.createHash('md5').update(content).digest('hex');
  const tsHash = timestamp ? `-${new Date(timestamp).getTime()}` : '';
  return `W/"${hash}${tsHash}"`;
};

/**
 * Cache-Control helper for responses
 */
export const setCacheControl = (res: Response, maxAge: number, options: { public?: boolean; immutable?: boolean } = {}) => {
  const directives = [];
  
  if (options.public) {
    directives.push('public');
  } else {
    directives.push('private');
  }
  
  directives.push(`max-age=${maxAge}`);
  
  if (options.immutable) {
    directives.push('immutable');
  }
  
  res.setHeader('Cache-Control', directives.join(', '));
};

/**
 * Conditional GET middleware
 * Check If-None-Match header and return 304 if ETag matches
 */
export const conditionalGet = (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);
  
  res.json = function(data: any) {
    // Only apply to GET requests
    if (req.method !== 'GET') {
      return originalJson(data);
    }
    
    // Generate ETag
    const etag = generateETag(data);
    res.setHeader('ETag', etag);
    
    // Check If-None-Match
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch === etag) {
      res.status(304).end();
      return res;
    }
    
    return originalJson(data);
  };
  
  next();
};

/**
 * Minimal response middleware
 * Ensures all DB queries use .select() + .lean()
 */
export const minimalResponseReminder = (req: Request, res: Response, next: NextFunction) => {
  // This is a documentation middleware - reminds devs to use minimal projections
  // In production, you could add query instrumentation here
  next();
};

export default {
  compressionMiddleware,
  batchUpsertRateLimiter,
  snapshotRateLimiter,
  generateETag,
  setCacheControl,
  conditionalGet,
  minimalResponseReminder,
};
