import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = err.status || 500;
  const payload = {
    success: false,
    error: err.message || 'Internal Server Error',
    details: err.details || undefined,
  };
  if (process.env.NODE_ENV !== 'production') {
    payload.details = payload.details || err.stack;
  }
  res.status(status).json(payload);
}

export function asyncHandler(fn: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
