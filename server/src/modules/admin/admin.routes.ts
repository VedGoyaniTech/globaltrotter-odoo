import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { Role } from '@prisma/client';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { ApiError } from '../../lib/errors.js';

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

    // Engagement: how much of the platform is actually being used, not just how
    // much exists.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [newUsers, newTrips, planners] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.trip.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.count({ where: { trips: { some: {} } } }),
    ]);

    res.json({
      counts: { users, trips, publicTrips, stops, activities, cities },
      averageStopsPerTrip: trips ? +(stops / trips).toFixed(2) : 0,
      engagement: {
        newUsersLast30Days: newUsers,
        newTripsLast30Days: newTrips,
        usersWithATrip: planners,
        // Share of travellers who have planned at least one trip.
        activationRate: users ? +((planners / users) * 100).toFixed(1) : 0,
        publicShareRate: trips ? +((publicTrips / trips) * 100).toFixed(1) : 0,
      },
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

const roleSchema = z.object({ role: z.nativeEnum(Role) });

/**
 * Guards shared by both destructive user actions. An admin must not be able to
 * lock the platform out of its own admin panel.
 */
async function assertSafeToModify(targetId: string, actorId: string, willRemoveAdmin: boolean) {
  if (targetId === actorId) {
    throw ApiError.badRequest('Use your own profile settings to change your own account');
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true },
  });
  if (!target) throw ApiError.notFound('User not found');

  if (willRemoveAdmin && target.role === Role.ADMIN) {
    const admins = await prisma.user.count({ where: { role: Role.ADMIN } });
    if (admins <= 1) throw ApiError.badRequest('The last admin cannot be removed');
  }

  return target;
}

// PATCH /api/admin/users/:userId/role - promote or demote a traveller.
adminRouter.patch(
  '/users/:userId/role',
  validate({ body: roleSchema }),
  asyncHandler(async (req, res) => {
    const { role } = req.body as z.infer<typeof roleSchema>;
    await assertSafeToModify(req.params.userId, req.user!.id, role === Role.USER);

    res.json(
      await prisma.user.update({
        where: { id: req.params.userId },
        data: { role },
        select: { id: true, name: true, email: true, role: true },
      }),
    );
  }),
);

// DELETE /api/admin/users/:userId - removes the account and cascades its trips.
adminRouter.delete(
  '/users/:userId',
  asyncHandler(async (req, res) => {
    await assertSafeToModify(req.params.userId, req.user!.id, true);
    await prisma.user.delete({ where: { id: req.params.userId } });
    res.status(204).end();
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
