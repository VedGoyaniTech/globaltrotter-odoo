import rateLimit, { type Options } from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * Auth endpoints are the only ones worth brute-forcing, so they get a tight
 * per-IP budget. The max is configurable so the test suite can raise it.
 */
export function makeAuthLimiter(overrides: Partial<Options> = {}) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Counting only failures keeps a legitimate user from locking themselves
    // out by signing in repeatedly on a shared IP.
    skipSuccessfulRequests: true,
    message: { error: 'Too many attempts. Try again in a few minutes.' },
    ...overrides,
  });
}

/**
 * Signup needs its own budget: the auth limiter skips successful requests, which
 * is right for login but would leave account creation unlimited.
 */
export function makeSignupLimiter(overrides: Partial<Options> = {}) {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: env.SIGNUP_RATE_LIMIT_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many accounts created from this address. Try again later.' },
    ...overrides,
  });
}

/** Password reset mints tokens and would otherwise be a free email/DB amplifier. */
export function makeResetLimiter(overrides: Partial<Options> = {}) {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: env.RESET_RATE_LIMIT_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many reset requests. Try again later.' },
    ...overrides,
  });
}
