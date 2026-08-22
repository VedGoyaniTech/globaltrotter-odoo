import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';

const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

type PageQuery = z.infer<typeof pageQuery>;

// Mounted at /api/admin - optional feature 13 in the brief.
export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [users, trips, publicTrips, stops, activities, cities] = await Promise.all([
      prisma.user.count(),
      prisma.trip.count(),
      prisma.trip.count({ where: { isPublic: true } }),
      prisma.tripStop.count(),
      prisma.tripActivity.count(),
      prisma.city.count(),
    ]);

    // Most-visited cities, ranked by how often they appear as a stop.
    const topCityRows = await prisma.tripStop.groupBy({
      by: ['cityId'],
      _count: { cityId: true },
      orderBy: { _count: { cityId: 'desc' } },
      take: 10,
    });
    const topCityDetails = await prisma.city.findMany({
      where: { id: { in: topCityRows.map((r) => r.cityId) } },
      select: { id: true, name: true, country: true },
    });
    // Spreading a missing city would emit a half-formed row, so drop any city
    // that disappeared between the groupBy and the lookup.
    const topCities = topCityRows.flatMap((r) => {
      const city = topCityDetails.find((c) => c.id === r.cityId);
      return city ? [{ ...city, stops: r._count.cityId }] : [];
    });

    const topActivityRows = await prisma.tripActivity.groupBy({
      by: ['name'],
      _count: { name: true },
      orderBy: { _count: { name: 'desc' } },
      take: 10,
    });

    res.json({
      counts: { users, trips, publicTrips, stops, activities, cities },
      averageStopsPerTrip: trips ? +(stops / trips).toFixed(2) : 0,
      topCities,
      topActivities: topActivityRows.map((r) => ({ name: r.name, uses: r._count.name })),
    });
  }),
);

adminRouter.get(
  '/users',
  validate({ query: pageQuery }),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query as unknown as PageQuery;
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          _count: { select: { trips: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count(),
    ]);
    res.json({ items, total, page, limit, pages: Math.ceil(total / limit) || 1 });
  }),
);

adminRouter.get(
  '/trips',
  validate({ query: pageQuery }),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query as unknown as PageQuery;
    const [items, total] = await Promise.all([
      prisma.trip.findMany({
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          isPublic: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
          _count: { select: { stops: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.trip.count(),
    ]);
    res.json({ items, total, page, limit, pages: Math.ceil(total / limit) || 1 });
  }),
);
