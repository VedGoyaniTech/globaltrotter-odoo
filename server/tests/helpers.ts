import request from 'supertest';
import { ActivityCategory, Role } from '@prisma/client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/lib/password.js';
import { signToken } from '../src/lib/jwt.js';

export const app = createApp();
export const api = () => request(app);

export const PASSWORD = 'Password123';

export async function makeUser(
  overrides: Partial<{ name: string; email: string; role: Role }> = {},
) {
  const user = await prisma.user.create({
    data: {
      name: overrides.name ?? 'Test User',
      email: overrides.email ?? `user-${Math.random().toString(36).slice(2, 10)}@test.dev`,
      passwordHash: await hashPassword(PASSWORD),
      role: overrides.role ?? Role.USER,
    },
  });
  return { user, token: signToken({ sub: user.id, role: user.role }) };
}

export function makeCity(
  overrides: Partial<{
    name: string;
    country: string;
    costIndex: number;
    popularity: number;
    region: string;
  }> = {},
) {
  return prisma.city.create({
    data: {
      name: overrides.name ?? `City-${Math.random().toString(36).slice(2, 8)}`,
      country: overrides.country ?? 'Testland',
      region: overrides.region ?? 'Europe',
      costIndex: overrides.costIndex ?? 100,
      popularity: overrides.popularity ?? 50,
    },
  });
}

export function makeActivity(
  cityId: string,
  overrides: Partial<{
    name: string;
    cost: number;
    durationMinutes: number;
    category: ActivityCategory;
  }> = {},
) {
  return prisma.activity.create({
    data: {
      cityId,
      name: overrides.name ?? 'Test Activity',
      cost: overrides.cost ?? 20,
      durationMinutes: overrides.durationMinutes ?? 90,
      category: overrides.category ?? ActivityCategory.SIGHTSEEING,
    },
  });
}

/** Fixed dates keep budget/timeline assertions deterministic. */
export const DATES = {
  start: '2026-06-01',
  end: '2026-06-05',
  day2: '2026-06-02',
};

export function makeTrip(userId: string, overrides: Record<string, unknown> = {}) {
  return prisma.trip.create({
    data: {
      userId,
      name: 'Test Trip',
      startDate: new Date(`${DATES.start}T00:00:00.000Z`),
      endDate: new Date(`${DATES.end}T00:00:00.000Z`),
      ...overrides,
    },
  });
}
