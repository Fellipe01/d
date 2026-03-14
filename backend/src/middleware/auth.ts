import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (env.NODE_ENV === 'development') { next(); return; }
  const key = req.headers['x-api-key'];
  if (key !== env.API_KEY) {
    res.status(401).json({ error: { message: 'Unauthorized' } });
    return;
  }
  next();
}
