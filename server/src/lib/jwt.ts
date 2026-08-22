import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export type JwtPayload = { sub: string; role: 'USER' | 'ADMIN' };

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
