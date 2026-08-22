import { Router } from 'express';
import type { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { budgetRouter } from '../budget/budget.routes.js';
import { stopsRouter } from '../stops/stops.routes.js';
import * as service from './trips.service.js';
import {
  createTripSchema,
  listTripsQuery,
  shareTripSchema,
  updateTripSchema,
} from './trips.schema.js';

export const tripsRouter = Router();
tripsRouter.use(requireAuth);

// Nested resources - both use mergeParams to read :tripId.
tripsRouter.use('/:tripId/stops', stopsRouter);
tripsRouter.use('/:tripId/budget', budgetRouter);

tripsRouter.get(
  '/',
  validate({ query: listTripsQuery }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listTripsQuery>;
    res.json(await service.listTrips(req.user!.id, q));
  }),
);

tripsRouter.post(
  '/',
  validate({ body: createTripSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await service.createTrip(req.user!.id, req.body));
  }),
);

tripsRouter.get(
  '/:tripId',
  asyncHandler(async (req, res) => {
    res.json(await service.getTrip(req.params.tripId, req.user!.id));
  }),
);

// Day-by-day projection for the Calendar / Timeline screen.
tripsRouter.get(
  '/:tripId/timeline',
  asyncHandler(async (req, res) => {
    const trip = await service.getTrip(req.params.tripId, req.user!.id);
    res.json({ tripId: trip.id, name: trip.name, days: service.buildDayByDay(trip) });
  }),
);

tripsRouter.patch(
  '/:tripId',
  validate({ body: updateTripSchema }),
  asyncHandler(async (req, res) => {
    res.json(await service.updateTrip(req.params.tripId, req.user!.id, req.body));
  }),
);

tripsRouter.delete(
  '/:tripId',
  asyncHandler(async (req, res) => {
    await service.deleteTrip(req.params.tripId, req.user!.id);
    res.status(204).end();
  }),
);

tripsRouter.post(
  '/:tripId/share',
  validate({ body: shareTripSchema }),
  asyncHandler(async (req, res) => {
    res.json(await service.setSharing(req.params.tripId, req.user!.id, req.body.isPublic));
  }),
);
