import { Router } from 'express';
import { ExpenseCategory } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { getOwnedTrip } from '../trips/trips.service.js';
import { getBreakdown } from './budget.service.js';

// Mounted at /api/trips/:tripId/budget
export const budgetRouter = Router({ mergeParams: true });

type Params = { tripId: string; expenseId?: string };

budgetRouter.use(
  asyncHandler(async (req, _res, next) => {
    await getOwnedTrip((req.params as Params).tripId, req.user!.id);
    next();
  }),
);

const expenseSchema = z.object({
  category: z.nativeEnum(ExpenseCategory),
  label: z.string().trim().min(1).max(160),
  amount: z.coerce.number().min(0),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .transform((v) => new Date(`${v}T00:00:00.000Z`))
    .optional(),
});

budgetRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await getBreakdown((req.params as Params).tripId));
  }),
);

budgetRouter.get(
  '/expenses',
  asyncHandler(async (req, res) => {
    res.json(
      await prisma.expense.findMany({
        where: { tripId: (req.params as Params).tripId },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }),
);

budgetRouter.post(
  '/expenses',
  validate({ body: expenseSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(
      await prisma.expense.create({
        data: { ...req.body, tripId: (req.params as Params).tripId },
      }),
    );
  }),
);

budgetRouter.patch(
  '/expenses/:expenseId',
  validate({ body: expenseSchema.partial() }),
  asyncHandler(async (req, res) => {
    const { tripId, expenseId } = req.params as Params;
    const existing = await prisma.expense.findUnique({ where: { id: expenseId } });
    if (!existing || existing.tripId !== tripId) throw ApiError.notFound('Expense not found');

    res.json(await prisma.expense.update({ where: { id: expenseId }, data: req.body }));
  }),
);

budgetRouter.delete(
  '/expenses/:expenseId',
  asyncHandler(async (req, res) => {
    const { tripId, expenseId } = req.params as Params;
    const existing = await prisma.expense.findUnique({ where: { id: expenseId } });
    if (!existing || existing.tripId !== tripId) throw ApiError.notFound('Expense not found');

    await prisma.expense.delete({ where: { id: expenseId } });
    res.status(204).end();
  }),
);
