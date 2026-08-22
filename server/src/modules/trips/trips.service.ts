import { nanoid } from 'nanoid';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';

/** Full itinerary shape used by the Itinerary View / Calendar screens. */
export const tripInclude = {
  stops: {
    orderBy: { orderIndex: 'asc' },
    include: {
      city: true,
      activities: { orderBy: { orderIndex: 'asc' } },
    },
  },
  expenses: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.TripInclude;

/** Loads a trip and asserts the caller owns it. Use before any mutation. */
export async function getOwnedTrip(tripId: string, userId: string) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw ApiError.notFound('Trip not found');
  if (trip.userId !== userId) throw ApiError.forbidden('This trip belongs to another user');
  return trip;
}

export type TripFilter = 'all' | 'upcoming' | 'ongoing' | 'past';

/**
 * The trip list screen buckets trips into three disjoint groups, so "upcoming"
 * means "has not started yet" rather than "has not finished yet".
 */
function filterClause(filter: TripFilter, today: Date): Prisma.TripWhereInput {
  switch (filter) {
    case 'upcoming':
      return { startDate: { gt: today } };
    case 'ongoing':
      return { startDate: { lte: today }, endDate: { gte: today } };
    case 'past':
      return { endDate: { lt: today } };
    default:
      return {};
  }
}

export async function listTrips(
  userId: string,
  opts: { q?: string; filter: TripFilter; page: number; limit: number },
) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const where: Prisma.TripWhereInput = {
    userId,
    ...(opts.q ? { name: { contains: opts.q, mode: 'insensitive' } } : {}),
    ...filterClause(opts.filter, today),
  };

  const [items, total] = await Promise.all([
    prisma.trip.findMany({
      where,
      orderBy: { startDate: opts.filter === 'past' ? 'desc' : 'asc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      include: {
        _count: { select: { stops: true } },
        stops: {
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            city: { select: { id: true, name: true, country: true } },
            // Ids only. The trip cards count experiences per stop, and without
            // this the count silently renders as zero.
            activities: { select: { id: true } },
          },
        },
      },
    }),
    prisma.trip.count({ where }),
  ]);

  return {
    items,
    total,
    page: opts.page,
    limit: opts.limit,
    pages: Math.ceil(total / opts.limit) || 1,
  };
}

/**
 * Dashboard summary: trip counts plus the budget highlights the home screen
 * shows. Everything is derived from one query over the user's live trips
 * rather than a per-trip round trip.
 */
export async function getDashboardSummary(userId: string) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const trips = await prisma.trip.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      budgetLimit: true,
      coverPhotoUrl: true,
      expenses: { select: { category: true, amount: true } },
      stops: { select: { activities: { select: { cost: true } } } },
    },
    orderBy: { startDate: 'asc' },
  });

  const counts = { total: trips.length, upcoming: 0, ongoing: 0, past: 0 };
  const byCategory: Record<string, number> = {
    TRANSPORT: 0,
    STAY: 0,
    ACTIVITIES: 0,
    MEALS: 0,
    OTHER: 0,
  };

  let plannedTotal = 0;
  let overBudgetTrips = 0;
  let nextTrip: {
    id: string;
    name: string;
    startDate: Date;
    daysUntil: number;
    total: number;
  } | null = null;
  let mostExpensive: { id: string; name: string; total: number } | null = null;

  for (const trip of trips) {
    const isPast = trip.endDate < today;
    const isFuture = trip.startDate > today;
    if (isPast) counts.past += 1;
    else if (isFuture) counts.upcoming += 1;
    else counts.ongoing += 1;

    const activityTotal = trip.stops.reduce(
      (sum, stop) => sum + stop.activities.reduce((inner, a) => inner + Number(a.cost), 0),
      0,
    );
    const expenseTotal = trip.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const total = activityTotal + expenseTotal;

    // Highlights describe money still to be spent, so finished trips are excluded.
    if (isPast) continue;

    plannedTotal += total;
    byCategory.ACTIVITIES += activityTotal;
    for (const e of trip.expenses) byCategory[e.category] += Number(e.amount);

    if (trip.budgetLimit !== null && total > Number(trip.budgetLimit)) overBudgetTrips += 1;
    if (!mostExpensive || total > mostExpensive.total) {
      mostExpensive = { id: trip.id, name: trip.name, total };
    }
    if (isFuture && !nextTrip) {
      nextTrip = {
        id: trip.id,
        name: trip.name,
        startDate: trip.startDate,
        daysUntil: Math.round((trip.startDate.getTime() - today.getTime()) / 86_400_000),
        total,
      };
    }
  }

  return {
    counts,
    nextTrip,
    budget: { plannedTotal, byCategory, overBudgetTrips, mostExpensive },
  };
}

export async function getTrip(tripId: string, userId: string) {
  await getOwnedTrip(tripId, userId);
  return prisma.trip.findUniqueOrThrow({ where: { id: tripId }, include: tripInclude });
}

export async function createTrip(userId: string, data: Prisma.TripUncheckedCreateInput) {
  return prisma.trip.create({ data: { ...data, userId }, include: tripInclude });
}

export async function updateTrip(tripId: string, userId: string, data: Prisma.TripUpdateInput) {
  const current = await getOwnedTrip(tripId, userId);

  // A partial update can send just one date, so the range has to be checked
  // against the merged value rather than against the request body alone.
  const startDate = (data.startDate as Date | undefined) ?? current.startDate;
  const endDate = (data.endDate as Date | undefined) ?? current.endDate;
  if (endDate < startDate) {
    throw ApiError.badRequest('Validation failed', {
      body: [{ path: 'endDate', message: 'endDate must be on or after startDate' }],
    });
  }

  return prisma.trip.update({ where: { id: tripId }, data, include: tripInclude });
}

export async function deleteTrip(tripId: string, userId: string) {
  await getOwnedTrip(tripId, userId);
  await prisma.trip.delete({ where: { id: tripId } });
}

/** Toggles public sharing and lazily mints a slug the first time it's turned on. */
export async function setSharing(tripId: string, userId: string, isPublic: boolean) {
  const trip = await getOwnedTrip(tripId, userId);
  return prisma.trip.update({
    where: { id: tripId },
    data: {
      isPublic,
      publicSlug: isPublic ? (trip.publicSlug ?? nanoid(12)) : trip.publicSlug,
    },
    select: { id: true, isPublic: true, publicSlug: true },
  });
}

type DayEntry = {
  date: string;
  cityId: string | null;
  cityName: string | null;
  activities: Awaited<ReturnType<typeof getTrip>>['stops'][number]['activities'];
};

/** Flattens the itinerary into one entry per calendar day for the timeline view. */
export function buildDayByDay(trip: Awaited<ReturnType<typeof getTrip>>): DayEntry[] {
  const days: DayEntry[] = [];
  const cursor = new Date(trip.startDate);

  while (cursor <= trip.endDate) {
    const iso = cursor.toISOString().slice(0, 10);
    const stop = trip.stops.find(
      (s) =>
        s.startDate.toISOString().slice(0, 10) <= iso &&
        iso <= s.endDate.toISOString().slice(0, 10),
    );

    days.push({
      date: iso,
      cityId: stop?.city.id ?? null,
      cityName: stop ? `${stop.city.name}, ${stop.city.country}` : null,
      activities:
        stop?.activities.filter(
          (a) => !a.scheduledDate || a.scheduledDate.toISOString().slice(0, 10) === iso,
        ) ?? [],
    });

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}
