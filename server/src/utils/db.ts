/**
 * Database Utilities - Type-safe helpers for Mongoose operations
 * 
 * Production-grade utilities for working with ObjectIds
 */

import { Types } from 'mongoose';

/**
 * Convert userId string to ObjectId
 * Throws if invalid format
 */
export function toObjectId(id: string | Types.ObjectId): Types.ObjectId {
  if (id instanceof Types.ObjectId) {
    return id;
  }
  
  if (!Types.ObjectId.isValid(id)) {
    throw new Error(`Invalid ObjectId format: ${id}`);
  }
  
  return new Types.ObjectId(id);
}

/**
 * Safely convert userId string to ObjectId
 * Returns null if invalid (no throw)
 */
export function toObjectIdSafe(id: string | Types.ObjectId | null | undefined): Types.ObjectId | null {
  if (!id) return null;
  if (id instanceof Types.ObjectId) return id;
  
  try {
    if (!Types.ObjectId.isValid(id)) return null;
    return new Types.ObjectId(id);
  } catch {
    return null;
  }
}

/**
 * Check if string is valid ObjectId format
 */
export function isValidObjectId(id: any): boolean {
  if (id instanceof Types.ObjectId) return true;
  if (typeof id !== 'string') return false;
  return Types.ObjectId.isValid(id);
}

/**
 * Convert ObjectId to string
 */
export function toIdString(id: Types.ObjectId | string): string {
  if (typeof id === 'string') return id;
  return id.toString();
}

/**
 * Express middleware: Convert x-user-id header to ObjectId
 */
export function parseUserIdMiddleware(req: any, res: any, next: any) {
  const userId = req.body.userId || req.headers['x-user-id'] || req.query.userId;
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: userId required' });
  }
  
  const objectId = toObjectIdSafe(userId);
  if (!objectId) {
    return res.status(400).json({ error: 'Invalid userId format' });
  }
  
  // Attach parsed ObjectId to request
  req.userId = objectId;
  req.userIdString = toIdString(objectId);
  
  next();
}
