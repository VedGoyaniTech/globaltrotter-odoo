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

export async function listTrips(
  userId: string,
  opts: { q?: string; filter: 'all' | 'upcoming' | 'past'; page: number; limit: number },
) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const where: Prisma.TripWhereInput = {
    userId,
    ...(opts.q ? { name: { contains: opts.q, mode: 'insensitive' } } : {}),
    ...(opts.filter === 'upcoming' ? { endDate: { gte: today } } : {}),
    ...(opts.filter === 'past' ? { endDate: { lt: today } } : {}),
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
          select: { city: { select: { id: true, name: true, country: true } } },
        },
      },
    }),
    prisma.trip.count({ where }),
  ]);

  return { items, total, page: opts.page, limit: opts.limit, pages: Math.ceil(total / opts.limit) || 1 };
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
      (s) => s.startDate.toISOString().slice(0, 10) <= iso && iso <= s.endDate.toISOString().slice(0, 10),
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
