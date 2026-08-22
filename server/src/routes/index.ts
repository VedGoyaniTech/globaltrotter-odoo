import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { usersRouter } from '../modules/users/users.routes.js';
import { tripsRouter } from '../modules/trips/trips.routes.js';
import { citiesRouter } from '../modules/cities/cities.routes.js';
import { activitiesRouter } from '../modules/activities/activities.routes.js';
import { shareRouter } from '../modules/share/share.routes.js';
import { adminRouter } from '../modules/admin/admin.routes.js';

export const apiRouter = Router();

/**
 * Liveness only - the process is up. Cheap enough for a load balancer to poll.
 */
apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

/**
 * Readiness - can this instance actually serve traffic? A shallow check would
 * report healthy while the database was unreachable, so this touches it.
 */
apiRouter.get(
  '/health/ready',
  asyncHandler(async (_req, res) => {
    const started = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      res.status(503).json({ status: 'unavailable', database: 'unreachable' });
      return;
    }
    res.json({
      status: 'ok',
      database: 'reachable',
      latencyMs: Date.now() - started,
      time: new Date().toISOString(),
    });
  }),
);

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/trips', tripsRouter); // also mounts /:tripId/stops and /:tripId/budget
apiRouter.use('/cities', citiesRouter);
apiRouter.use('/activities', activitiesRouter);
apiRouter.use('/public', shareRouter);
apiRouter.use('/admin', adminRouter);
