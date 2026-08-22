import { Router } from 'express';
import type { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { ApiError } from '../../lib/errors.js';
import { publicUrlFor, removeUploaded, uploadImage } from '../../middleware/upload.js';
import { prisma } from '../../lib/prisma.js';
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

// POST /api/trips/:tripId/cover - multipart/form-data, field name "image".
tripsRouter.post(
  '/:tripId/cover',
  // Ownership is checked before multer runs, otherwise a stranger's rejected
  // request would still have written a file to disk.
  asyncHandler(async (req, _res, next) => {
    await service.getOwnedTrip(req.params.tripId, req.user!.id);
    next();
  }),
  uploadImage,
  asyncHandler(async (req, res) => {
    const trip = await service.getOwnedTrip(req.params.tripId, req.user!.id);
    if (!req.file) throw ApiError.badRequest('No image was uploaded');

    const updated = await prisma.trip.update({
      where: { id: trip.id },
      data: { coverPhotoUrl: publicUrlFor(req.file.filename) },
      select: { id: true, coverPhotoUrl: true },
    });

    removeUploaded(trip.coverPhotoUrl);
    res.status(201).json(updated);
  }),
);

tripsRouter.post(
  '/:tripId/share',
  validate({ body: shareTripSchema }),
  asyncHandler(async (req, res) => {
    res.json(await service.setSharing(req.params.tripId, req.user!.id, req.body.isPublic));
  }),
);
