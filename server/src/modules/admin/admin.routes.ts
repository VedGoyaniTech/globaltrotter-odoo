import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';

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
    const topCities = topCityRows.map((r) => ({
      ...topCityDetails.find((c) => c.id === r.cityId),
      stops: r._count.cityId,
    }));

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
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          _count: { select: { trips: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  }),
);

adminRouter.get(
  '/trips',
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.trip.findMany({
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
        take: 100,
      }),
    );
  }),
);
