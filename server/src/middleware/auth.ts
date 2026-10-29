import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { AuthRequest, AuthUser } from '../types';
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
  try { req.user = jwt.verify(token, config.jwtSecret) as AuthUser; next(); }
  catch { return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' }); }
}
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Administrator access required.' });
  next();
}
