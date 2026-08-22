import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export type JwtPayload = { sub: string; role: 'USER' | 'ADMIN' };

const ALGORITHM = 'HS256' as const;

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JwtPayload {
  // Pinning the algorithm matters: left to the library, a token could ask to be
  // verified under a scheme we never intended to accept.
  return jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITHM] }) as JwtPayload;
}
