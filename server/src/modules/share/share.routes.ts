import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
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

const feedQuery = z.object({
  q: z.string().trim().max(120).optional(),
  country: z.string().trim().max(80).optional(),
  sort: z.enum(['recent', 'soonest', 'stops']).default('recent'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

// GET /api/public/trips - Community tab: browse every shared itinerary.
shareRouter.get(
  '/trips',
  validate({ query: feedQuery }),
  asyncHandler(async (req, res) => {
    const { q, country, sort, page, limit } = req.query as unknown as z.infer<typeof feedQuery>;

    const where: Prisma.TripWhereInput = {
      isPublic: true,
      publicSlug: { not: null },
      // Search matches the trip name or any city on the itinerary.
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
              { stops: { some: { city: { name: { contains: q, mode: 'insensitive' } } } } },
            ],
          }
        : {}),
      ...(country
        ? { stops: { some: { city: { country: { equals: country, mode: 'insensitive' } } } } }
        : {}),
    };

    const orderBy: Prisma.TripOrderByWithRelationInput =
      sort === 'soonest'
        ? { startDate: 'asc' }
        : sort === 'stops'
          ? { stops: { _count: 'desc' } }
          : { createdAt: 'desc' };

    const [rows, total] = await Promise.all([
      prisma.trip.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          startDate: true,
          endDate: true,
          coverPhotoUrl: true,
          publicSlug: true,
          createdAt: true,
          user: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { stops: true } },
          stops: {
            orderBy: { orderIndex: 'asc' },
            select: { city: { select: { id: true, name: true, country: true } } },
          },
        },
      }),
      prisma.trip.count({ where }),
    ]);

    // Flatten the stop rows into a plain city list - the card only needs names.
    const items = rows.map(({ stops, _count, ...trip }) => ({
      ...trip,
      stopCount: _count.stops,
      cities: stops.map((s) => s.city),
    }));

    res.json({ items, total, page, limit, pages: Math.ceil(total / limit) || 1 });
  }),
);

// GET /api/public/countries - country filter options for the community tab.
shareRouter.get(
  '/countries',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.tripStop.findMany({
      where: { trip: { isPublic: true } },
      select: { city: { select: { country: true } } },
      distinct: ['cityId'],
    });
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.city.country, (counts.get(r.city.country) ?? 0) + 1);
    res.json(
      [...counts.entries()]
        .map(([country, cities]) => ({ country, cities }))
        .sort((a, b) => a.country.localeCompare(b.country)),
    );
  }),
);

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
