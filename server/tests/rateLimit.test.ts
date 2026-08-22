import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeAuthLimiter, makeResetLimiter } from '../src/middleware/rateLimit.js';

/**
 * The limiters mounted on /api/auth are module-level singletons shared by every
 * test file, so the real limits are raised in vitest.config.ts and the
 * behaviour is verified here against fresh instances with a small budget.
 */
function appWith(limiter: express.RequestHandler, status: number) {
  const app = express();
  app.get('/probe', limiter, (_req, res) => {
    res.status(status).json({ status });
  });
  return app;
}

describe('auth rate limiter', () => {
  it('blocks once the failure budget is spent', async () => {
    const app = appWith(makeAuthLimiter({ limit: 2 }), 401);

    expect((await request(app).get('/probe')).status).toBe(401);
    expect((await request(app).get('/probe')).status).toBe(401);

    const blocked = await request(app).get('/probe');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toContain('Too many attempts');
  });

  it('does not spend budget on successful requests', async () => {
    const app = appWith(makeAuthLimiter({ limit: 2 }), 200);

    for (let i = 0; i < 5; i++) {
      expect((await request(app).get('/probe')).status).toBe(200);
    }
  });

  it('advertises the remaining budget in draft-7 headers', async () => {
    const app = appWith(makeAuthLimiter({ limit: 2 }), 401);
    const res = await request(app).get('/probe');

    expect(res.headers['ratelimit-policy']).toBeDefined();
    expect(res.headers['x-ratelimit-limit']).toBeUndefined(); // legacy headers off
  });
});

describe('password reset limiter', () => {
  it('counts every request, successful or not', async () => {
    const app = appWith(makeResetLimiter({ limit: 2 }), 200);

    expect((await request(app).get('/probe')).status).toBe(200);
    expect((await request(app).get('/probe')).status).toBe(200);

    const blocked = await request(app).get('/probe');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toContain('Too many reset requests');
  });
});
