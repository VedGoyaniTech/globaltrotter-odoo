import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { buildDayByDay, tripInclude } from '../trips/trips.service.js';

// Mounted at /api/public - read-only, no auth required.
export const shareRouter = Router();

async function loadPublicTrip(slug: string) {
  const trip = await prisma.trip.findUnique({
    where: { publicSlug: slug },
    include: { ...tripInclude, user: { select: { id: true, name: true, avatarUrl: true } } },
  });
  if (!trip || !trip.isPublic) throw ApiError.notFound('This itinerary is not public');
  return trip;
}

// GET /api/public/trips/:slug - Shared / Public Itinerary View screen.
shareRouter.get(
  '/trips/:slug',
  asyncHandler(async (req, res) => {
    const trip = await loadPublicTrip(req.params.slug);
    const { userId: _hidden, ...rest } = trip;
    res.json({ ...rest, days: buildDayByDay(trip) });
  }),
);

// POST /api/public/trips/:slug/copy - "Copy Trip" into the caller's account.
shareRouter.post(
  '/trips/:slug/copy',
  requireAuth,
  asyncHandler(async (req, res) => {
    const source = await loadPublicTrip(req.params.slug);

    const copy = await prisma.trip.create({
      data: {
        userId: req.user!.id,
        name: `${source.name} (copy)`,
        description: source.description,
        startDate: source.startDate,
        endDate: source.endDate,
        coverPhotoUrl: source.coverPhotoUrl,
        budgetLimit: source.budgetLimit,
        copiedFromId: source.id,
        isPublic: false,
        stops: {
          create: source.stops.map((stop) => ({
            cityId: stop.cityId,
            startDate: stop.startDate,
            endDate: stop.endDate,
            orderIndex: stop.orderIndex,
            notes: stop.notes,
            activities: {
              create: stop.activities.map((a) => ({
                activityId: a.activityId,
                name: a.name,
                notes: a.notes,
                scheduledDate: a.scheduledDate,
                startTime: a.startTime,
                durationMinutes: a.durationMinutes,
                cost: a.cost,
                orderIndex: a.orderIndex,
              })),
            },
          })),
        },
        expenses: {
          create: source.expenses.map((e) => ({
            category: e.category,
            label: e.label,
            amount: e.amount,
            date: e.date,
          })),
        },
      },
      include: tripInclude,
    });

    res.status(201).json(copy);
  }),
);
