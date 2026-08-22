import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validate } from '../../middleware/validate.js';

export const citiesRouter = Router();

const listQuery = z.object({
  q: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional(),
  region: z.string().trim().max(80).optional(),
  sort: z.enum(['popularity', 'name', 'costIndex']).default('popularity'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// GET /api/cities - search + filter, used by the City Search screen.
citiesRouter.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const { q, country, region, sort, page, limit } = req.query as unknown as z.infer<
      typeof listQuery
    >;

    const where: Prisma.CityWhereInput = {
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      ...(country ? { country: { equals: country, mode: 'insensitive' } } : {}),
      ...(region ? { region: { equals: region, mode: 'insensitive' } } : {}),
    };

    const orderBy: Prisma.CityOrderByWithRelationInput =
      sort === 'name' ? { name: 'asc' } : sort === 'costIndex' ? { costIndex: 'asc' } : { popularity: 'desc' };

    const [items, total] = await Promise.all([
      prisma.city.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { activities: true } } },
      }),
      prisma.city.count({ where }),
    ]);

    res.json({ items, total, page, limit, pages: Math.ceil(total / limit) || 1 });
  }),
);

// GET /api/cities/countries - filter options for the search UI.
citiesRouter.get(
  '/countries',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.city.groupBy({
      by: ['country'],
      _count: { country: true },
      orderBy: { country: 'asc' },
    });
    res.json(rows.map((r) => ({ country: r.country, cities: r._count.country })));
  }),
);

citiesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const city = await prisma.city.findUnique({
      where: { id: req.params.id },
      include: { activities: { orderBy: { name: 'asc' } } },
    });
    if (!city) throw ApiError.notFound('City not found');
    res.json(city);
  }),
);
