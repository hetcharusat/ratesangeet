import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';

// Helper: extract user id or bearer token
function getCredentials(req: Request): { userId?: string; bearer?: string } {
  const headers = req.headers || {};
  const auth = headers['authorization'] || headers['Authorization'] as string | undefined;
  const bearer = auth && auth.toLowerCase().startsWith('bearer ')
    ? auth.slice(7).trim()
    : undefined;

  // Prefer explicit header first, then body/query fallbacks
  const headerUserId = (headers['x-user-id'] as string | undefined) || (headers['x-user'] as string | undefined);
  const bodyUserId = (req.body && (req.body.userId as string | undefined)) || undefined;
  const queryUserId = (req.query && (req.query.userId as string | undefined)) || undefined;

  return {
    userId: headerUserId || bodyUserId || queryUserId,
    bearer,
  };
}

// Middleware: require authenticated user
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, bearer } = getCredentials(req);

    let userDoc: any = null;

    // If userId provided and looks like ObjectId, prefer it
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      userDoc = await User.findById(userId).select('_id spotifyId username displayName accessToken');
    }

    // Fallback: try to find by spotifyId if userId is not an ObjectId
    if (!userDoc && userId && !mongoose.Types.ObjectId.isValid(userId)) {
      userDoc = await User.findOne({ spotifyId: userId }).select('_id spotifyId username displayName accessToken');
    }

    // Last resort: if bearer token present, try to match by current access token
    if (!userDoc && bearer) {
      userDoc = await User.findOne({ accessToken: bearer }).select('_id spotifyId username displayName accessToken');
    }

    if (!userDoc) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    (req as any).authUser = userDoc;
    return next();
  } catch (err: any) {
    console.error('[AUTH] Error resolving user:', err?.message || err);
    return res.status(500).json({ error: 'Auth middleware failed' });
  }
}

// Middleware factory: ensure the authenticated user matches a route param (e.g., :id)
export function requireSelfParam(paramName: string = 'id') {
  return (req: Request, res: Response, next: NextFunction) => {
    const authUser = (req as any).authUser as { _id?: any } | undefined;
    if (!authUser) return res.status(401).json({ error: 'Authentication required' });
    const targetId = req.params?.[paramName];
    if (!targetId || String(authUser._id) !== String(targetId)) {
      return res.status(403).json({ error: 'Forbidden (not your resource)' });
    }
    return next();
  };
}

// Middleware factory: ensure a body field equals authenticated user id (e.g., followerId/userId in body)
export function requireSelfBody(fieldName: string = 'userId') {
  return (req: Request, res: Response, next: NextFunction) => {
    const authUser = (req as any).authUser as { _id?: any } | undefined;
    if (!authUser) return res.status(401).json({ error: 'Authentication required' });
    const fieldVal = (req.body && req.body[fieldName]) as string | undefined;
    if (!fieldVal) {
      // If field missing, we can inject it for convenience
      req.body = { ...(req.body || {}), [fieldName]: String(authUser._id) };
      return next();
    }
    if (String(fieldVal) !== String(authUser._id)) {
      return res.status(403).json({ error: `Forbidden (body.${fieldName} must be your user id)` });
    }
    return next();
  };
}
