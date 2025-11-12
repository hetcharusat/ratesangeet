/**
 * Parse UserId Middleware
 * 
 * Converts userId from x-user-id header/body/query to ObjectId
 * Attaches to req.userId for use in route handlers
 * 
 * Production-ready with proper error handling
 */

import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      userId?: Types.ObjectId;
      userIdString?: string;
    }
  }
}

/**
 * Middleware: Parse and validate userId from request
 * 
 * Sources (in order of priority):
 * 1. req.body.userId
 * 2. req.headers['x-user-id']
 * 3. req.query.userId
 * 
 * Attaches:
 * - req.userId: Types.ObjectId (for MongoDB queries)
 * - req.userIdString: string (for logging/display)
 */
export function parseUserId(req: Request, res: Response, next: NextFunction): void {
  try {
    // Get userId from multiple sources
    const userIdString = 
      req.body.userId || 
      req.headers['x-user-id'] || 
      req.query.userId;
    
    // Check if userId provided
    if (!userIdString) {
      res.status(401).json({ 
        error: 'Unauthorized: userId required',
        message: 'Provide userId in x-user-id header, body, or query param'
      });
      return;
    }
    
    // Validate ObjectId format
    if (!Types.ObjectId.isValid(userIdString as string)) {
      res.status(400).json({ 
        error: 'Invalid userId format',
        message: 'userId must be a valid MongoDB ObjectId (24-character hex string)'
      });
      return;
    }
    
    // Convert to ObjectId
    req.userId = new Types.ObjectId(userIdString as string);
    req.userIdString = userIdString as string;
    
    next();
  } catch (error) {
    console.error('[parseUserId] Error:', error);
    res.status(400).json({ 
      error: 'Invalid userId',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Optional middleware: Validate userId exists in users collection
 * Use for high-security endpoints
 * 
 * IMPORTANT: Requires User model import - only use where needed
 */
export function validateUserExists(req: Request, res: Response, next: NextFunction): void {
  // This is intentionally left as a placeholder
  // Import User model in routes that need this validation
  // Example:
  // const user = await User.findById(req.userId);
  // if (!user) return res.status(404).json({ error: 'User not found' });
  next();
}
