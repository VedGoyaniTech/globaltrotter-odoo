import { z } from 'zod';
import { httpUrl } from '../../lib/validation.js';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date (YYYY-MM-DD)')
  .transform((v) => new Date(`${v}T00:00:00.000Z`));

export const dateRange = { isoDate };

export const createTripSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000).optional(),
    startDate: isoDate,
    endDate: isoDate,
    coverPhotoUrl: httpUrl().optional(),
    budgetLimit: z.coerce.number().min(0).optional(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  });

export const updateTripSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    coverPhotoUrl: httpUrl().nullable().optional(),
    budgetLimit: z.coerce.number().min(0).nullable().optional(),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  });

export const listTripsQuery = z.object({
  q: z.string().trim().max(120).optional(),
  filter: z.enum(['all', 'upcoming', 'ongoing', 'past']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const shareTripSchema = z.object({
  isPublic: z.boolean(),
});
