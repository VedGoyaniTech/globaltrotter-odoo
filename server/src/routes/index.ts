import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes.js';
import { usersRouter } from '../modules/users/users.routes.js';
import { tripsRouter } from '../modules/trips/trips.routes.js';
import { citiesRouter } from '../modules/cities/cities.routes.js';
import { activitiesRouter } from '../modules/activities/activities.routes.js';
import { shareRouter } from '../modules/share/share.routes.js';
import { adminRouter } from '../modules/admin/admin.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/trips', tripsRouter); // also mounts /:tripId/stops and /:tripId/budget
apiRouter.use('/cities', citiesRouter);
apiRouter.use('/activities', activitiesRouter);
apiRouter.use('/public', shareRouter);
apiRouter.use('/admin', adminRouter);
