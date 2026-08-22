import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/errors.js';
import { verifyToken } from '../lib/jwt.js';

/**
 * Bearer header only. Cookie auth is deliberately not accepted: combined with
 * cors({ credentials: true }) and no CSRF token it would make every
 * state-changing route forgeable from another origin.
 */
function readToken(req: Request): string | null {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

/** Rejects the request unless a valid token is present. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req);
  if (!token) return next(ApiError.unauthorized());
  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(ApiError.unauthorized('Invalid or expired token'));
  }
}

/** Attaches req.user when a token is present, but never rejects. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req);
  if (token) {
    try {
      const payload = verifyToken(token);
      req.user = { id: payload.sub, role: payload.role };
    } catch {
      /* ignore - treated as anonymous */
    }
  }
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') return next(ApiError.forbidden('Admin only'));
  next();
}
