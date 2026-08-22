import { z } from 'zod';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date (YYYY-MM-DD)')
  .transform((v) => new Date(`${v}T00:00:00.000Z`));

export const createStopSchema = z
  .object({
    cityId: z.string().min(1),
    startDate: isoDate,
    endDate: isoDate,
    notes: z.string().trim().max(1000).optional(),
    budget: z.coerce.number().min(0).optional(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  });

export const updateStopSchema = z.object({
  cityId: z.string().min(1).optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  budget: z.coerce.number().min(0).nullable().optional(),
});

/** Full ordered list of stop ids - used by drag-to-reorder. */
export const reorderStopsSchema = z.object({
  stopIds: z.array(z.string().min(1)).min(1),
});

/** Full ordered list of activity ids on one stop - used by drag-to-reorder. */
export const reorderActivitiesSchema = z.object({
  activityIds: z.array(z.string().min(1)).min(1),
});

export const createTripActivitySchema = z.object({
  activityId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  notes: z.string().trim().max(1000).optional(),
  scheduledDate: isoDate.optional(),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm')
    .optional(),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(0)
    .max(24 * 60)
    .optional(),
  cost: z.coerce.number().min(0).optional(),
});

export const updateTripActivitySchema = createTripActivitySchema.extend({
  orderIndex: z.coerce.number().int().min(0).optional(),
});
