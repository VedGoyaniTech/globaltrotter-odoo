import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { getOwnedTrip } from '../trips/trips.service.js';
import {
  createStopSchema,
  createTripActivitySchema,
  reorderStopsSchema,
  updateStopSchema,
  updateTripActivitySchema,
} from './stops.schema.js';

// Mounted at /api/trips/:tripId/stops
export const stopsRouter = Router({ mergeParams: true });

type Params = { tripId: string; stopId?: string; activityId?: string };

/** Every route here mutates someone's itinerary, so ownership is checked first. */
stopsRouter.use(
  asyncHandler(async (req, _res, next) => {
    await getOwnedTrip((req.params as Params).tripId, req.user!.id);
    next();
  }),
);

async function loadStop(tripId: string, stopId: string) {
  const stop = await prisma.tripStop.findUnique({ where: { id: stopId } });
  if (!stop || stop.tripId !== tripId) throw ApiError.notFound('Stop not found on this trip');
  return stop;
}

// --- Stops ---

stopsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(
      await prisma.tripStop.findMany({
        where: { tripId: (req.params as Params).tripId },
        orderBy: { orderIndex: 'asc' },
        include: { city: true, activities: { orderBy: { orderIndex: 'asc' } } },
      }),
    );
  }),
);

stopsRouter.post(
  '/',
  validate({ body: createStopSchema }),
  asyncHandler(async (req, res) => {
    const { tripId } = req.params as Params;
    const last = await prisma.tripStop.findFirst({
      where: { tripId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });

    res.status(201).json(
      await prisma.tripStop.create({
        data: { ...req.body, tripId, orderIndex: (last?.orderIndex ?? -1) + 1 },
        include: { city: true, activities: true },
      }),
    );
  }),
);

// PUT /reorder must be declared before /:stopId so it isn't captured as an id.
stopsRouter.put(
  '/reorder',
  validate({ body: reorderStopsSchema }),
  asyncHandler(async (req, res) => {
    const { tripId } = req.params as Params;
    const { stopIds } = req.body as { stopIds: string[] };

    const existing = await prisma.tripStop.findMany({
      where: { tripId },
      select: { id: true },
    });
    const known = new Set(existing.map((s) => s.id));
    if (stopIds.length !== known.size || stopIds.some((id) => !known.has(id))) {
      throw ApiError.badRequest('stopIds must list every stop on this trip exactly once');
    }

    // Two passes: park the rows at negative indexes first so the
    // @@unique([tripId, orderIndex]) constraint can't collide mid-update.
    await prisma.$transaction([
      ...stopIds.map((id, i) =>
        prisma.tripStop.update({ where: { id }, data: { orderIndex: -(i + 1) } }),
      ),
      ...stopIds.map((id, i) => prisma.tripStop.update({ where: { id }, data: { orderIndex: i } })),
    ]);

    res.json(
      await prisma.tripStop.findMany({
        where: { tripId },
        orderBy: { orderIndex: 'asc' },
        include: { city: true },
      }),
    );
  }),
);

stopsRouter.patch(
  '/:stopId',
  validate({ body: updateStopSchema }),
  asyncHandler(async (req, res) => {
    const { tripId, stopId } = req.params as Params;
    const current = await loadStop(tripId, stopId!);

    // updateStopSchema cannot compare the two dates because either may be absent,
    // so the merged range is checked here.
    const body = req.body as { startDate?: Date; endDate?: Date };
    const startDate = body.startDate ?? current.startDate;
    const endDate = body.endDate ?? current.endDate;
    if (endDate < startDate) {
      throw ApiError.badRequest('Validation failed', {
        body: [{ path: 'endDate', message: 'endDate must be on or after startDate' }],
      });
    }

    res.json(
      await prisma.tripStop.update({
        where: { id: stopId },
        data: req.body,
        include: { city: true, activities: { orderBy: { orderIndex: 'asc' } } },
      }),
    );
  }),
);

stopsRouter.delete(
  '/:stopId',
  asyncHandler(async (req, res) => {
    const { tripId, stopId } = req.params as Params;
    await loadStop(tripId, stopId!);
    await prisma.tripStop.delete({ where: { id: stopId } });
    res.status(204).end();
  }),
);

// --- Activities attached to a stop ---

stopsRouter.post(
  '/:stopId/activities',
  validate({ body: createTripActivitySchema }),
  asyncHandler(async (req, res) => {
    const { tripId, stopId } = req.params as Params;
    await loadStop(tripId, stopId!);

    const body = req.body as Record<string, unknown> & { activityId?: string; name?: string };

    // Catalogue activities supply their own defaults; custom ones must name themselves.
    let defaults: { name: string; cost?: number; durationMinutes?: number } | null = null;
    if (body.activityId) {
      const catalogue = await prisma.activity.findUnique({ where: { id: body.activityId } });
      if (!catalogue) throw ApiError.badRequest('Unknown activityId');
      defaults = {
        name: catalogue.name,
        cost: Number(catalogue.cost),
        durationMinutes: catalogue.durationMinutes,
      };
    }

    const name = body.name ?? defaults?.name;
    if (!name) throw ApiError.badRequest('name is required for a custom activity');

    const last = await prisma.tripActivity.findFirst({
      where: { tripStopId: stopId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });

    res.status(201).json(
      await prisma.tripActivity.create({
        data: {
          tripStopId: stopId!,
          activityId: body.activityId ?? null,
          name,
          notes: (body.notes as string) ?? null,
          scheduledDate: (body.scheduledDate as Date) ?? null,
          startTime: (body.startTime as string) ?? null,
          durationMinutes: (body.durationMinutes as number) ?? defaults?.durationMinutes ?? 60,
          cost: (body.cost as number) ?? defaults?.cost ?? 0,
          orderIndex: (last?.orderIndex ?? -1) + 1,
        },
      }),
    );
  }),
);

stopsRouter.patch(
  '/:stopId/activities/:activityId',
  validate({ body: updateTripActivitySchema }),
  asyncHandler(async (req, res) => {
    const { tripId, stopId, activityId } = req.params as Params;
    await loadStop(tripId, stopId!);

    const existing = await prisma.tripActivity.findUnique({ where: { id: activityId } });
    if (!existing || existing.tripStopId !== stopId) throw ApiError.notFound('Activity not found');

    res.json(await prisma.tripActivity.update({ where: { id: activityId }, data: req.body }));
  }),
);

stopsRouter.delete(
  '/:stopId/activities/:activityId',
  asyncHandler(async (req, res) => {
    const { tripId, stopId, activityId } = req.params as Params;
    await loadStop(tripId, stopId!);

    const existing = await prisma.tripActivity.findUnique({ where: { id: activityId } });
    if (!existing || existing.tripStopId !== stopId) throw ApiError.notFound('Activity not found');

    await prisma.tripActivity.delete({ where: { id: activityId } });
    res.status(204).end();
  }),
);
