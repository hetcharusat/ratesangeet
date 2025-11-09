import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

/**
 * Middleware to ensure MongoDB is connected before processing requests
 * Prevents "MongoNotConnectedError" at runtime
 */
export function ensureMongoConnected(req: Request, res: Response, next: NextFunction) {
  // Check if mongoose is connected
  if (mongoose.connection.readyState !== 1) {
    console.error(`⚠️  MongoDB not connected (state: ${mongoose.connection.readyState}) - rejecting request to ${req.path}`);
    
    // ReadyState values:
    // 0 = disconnected
    // 1 = connected
    // 2 = connecting
    // 3 = disconnecting
    
    return res.status(503).json({
      error: 'Database temporarily unavailable',
      message: 'The server is reconnecting to the database. Please try again in a moment.',
      code: 'DB_UNAVAILABLE'
    });
  }
  
  next();
}
