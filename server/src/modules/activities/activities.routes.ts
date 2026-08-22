import { Router } from 'express';
import { Prisma, ActivityCategory } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validate } from '../../middleware/validate.js';

export const activitiesRouter = Router();

const listQuery = z.object({
  q: z.string().trim().max(80).optional(),
  cityId: z.string().optional(),
  category: z.nativeEnum(ActivityCategory).optional(),
  maxCost: z.coerce.number().min(0).optional(),
  maxDuration: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['name', 'cost', 'duration']).default('name'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// GET /api/activities - powers the Activity Search screen.
activitiesRouter.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const { q, cityId, category, maxCost, maxDuration, sort, page, limit } =
      req.query as unknown as z.infer<typeof listQuery>;

    const where: Prisma.ActivityWhereInput = {
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      ...(cityId ? { cityId } : {}),
      ...(category ? { category } : {}),
      ...(maxCost !== undefined ? { cost: { lte: maxCost } } : {}),
      ...(maxDuration !== undefined ? { durationMinutes: { lte: maxDuration } } : {}),
    };

    const orderBy: Prisma.ActivityOrderByWithRelationInput =
      sort === 'cost' ? { cost: 'asc' } : sort === 'duration' ? { durationMinutes: 'asc' } : { name: 'asc' };

    const [items, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: { city: { select: { id: true, name: true, country: true } } },
      }),
      prisma.activity.count({ where }),
    ]);

    res.json({ items, total, page, limit, pages: Math.ceil(total / limit) || 1 });
  }),
);

activitiesRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    res.json(Object.values(ActivityCategory));
  }),
);

activitiesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const activity = await prisma.activity.findUnique({
      where: { id: req.params.id },
      include: { city: true },
    });
    if (!activity) throw ApiError.notFound('Activity not found');
    res.json(activity);
  }),
);
