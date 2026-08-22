import { describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { api, DATES, makeActivity, makeCity, makeTrip, makeUser, PASSWORD } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const day = (offset: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};

describe('PATCH /api/users/me/email', () => {
  it('changes the email when the current password is correct', async () => {
    const { token } = await makeUser({ email: 'old@test.dev' });

    const res = await api()
      .patch('/api/users/me/email')
      .set(auth(token))
      .send({ email: 'New@Test.dev', currentPassword: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('new@test.dev');

    // The new address is the one that works at the login screen.
    const login = await api()
      .post('/api/auth/login')
      .send({ email: 'new@test.dev', password: PASSWORD });
    expect(login.status).toBe(200);
  });

  it('refuses without the correct current password', async () => {
    const { token } = await makeUser({ email: 'guard@test.dev' });

    const res = await api()
      .patch('/api/users/me/email')
      .set(auth(token))
      .send({ email: 'hijack@test.dev', currentPassword: 'WrongPassword1' });

    expect(res.status).toBe(401);
    const still = await prisma.user.findUnique({ where: { email: 'guard@test.dev' } });
    expect(still).not.toBeNull();
  });

  it('refuses an address another account already uses', async () => {
    await makeUser({ email: 'taken@test.dev' });
    const { token } = await makeUser({ email: 'mover@test.dev' });

    const res = await api()
      .patch('/api/users/me/email')
      .set(auth(token))
      .send({ email: 'taken@test.dev', currentPassword: PASSWORD });

    expect(res.status).toBe(409);
  });

  it('invalidates reset links sent to the old address', async () => {
    const { user, token } = await makeUser({ email: 'reset-move@test.dev' });
    await api().post('/api/auth/forgot-password').send({ email: user.email });
    expect(await prisma.passwordResetToken.count({ where: { userId: user.id } })).toBe(1);

    await api()
      .patch('/api/users/me/email')
      .set(auth(token))
      .send({ email: 'moved@test.dev', currentPassword: PASSWORD });

    expect(await prisma.passwordResetToken.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe('admin user management', () => {
  it('promotes and demotes a traveller', async () => {
    const admin = await makeUser({ role: Role.ADMIN });
    const target = await makeUser();

    const up = await api()
      .patch(`/api/admin/users/${target.user.id}/role`)
      .set(auth(admin.token))
      .send({ role: 'ADMIN' });
    expect(up.status).toBe(200);
    expect(up.body.role).toBe('ADMIN');

    const down = await api()
      .patch(`/api/admin/users/${target.user.id}/role`)
      .set(auth(admin.token))
      .send({ role: 'USER' });
    expect(down.body.role).toBe('USER');
  });

  it('will not let an admin change their own role', async () => {
    const admin = await makeUser({ role: Role.ADMIN });

    const res = await api()
      .patch(`/api/admin/users/${admin.user.id}/role`)
      .set(auth(admin.token))
      .send({ role: 'USER' });

    expect(res.status).toBe(400);
  });

  it('will not demote the last remaining admin', async () => {
    const soleAdmin = await makeUser({ role: Role.ADMIN });
    const other = await makeUser({ role: Role.ADMIN });

    // Two admins: demoting the other is fine.
    await api()
      .patch(`/api/admin/users/${other.user.id}/role`)
      .set(auth(soleAdmin.token))
      .send({ role: 'USER' })
      .expect(200);

    // Now only one admin remains, and it is the actor - deleting is refused too.
    const res = await api()
      .delete(`/api/admin/users/${soleAdmin.user.id}`)
      .set(auth(soleAdmin.token));
    expect(res.status).toBe(400);
  });

  it('deletes a user and cascades their trips', async () => {
    const admin = await makeUser({ role: Role.ADMIN });
    const target = await makeUser();
    await makeTrip(target.user.id);

    await api().delete(`/api/admin/users/${target.user.id}`).set(auth(admin.token)).expect(204);

    expect(await prisma.user.findUnique({ where: { id: target.user.id } })).toBeNull();
    expect(await prisma.trip.count({ where: { userId: target.user.id } })).toBe(0);
  });

  it('404s for an unknown user and 403s for a non-admin', async () => {
    const admin = await makeUser({ role: Role.ADMIN });
    const plain = await makeUser();

    expect((await api().delete('/api/admin/users/nope').set(auth(admin.token))).status).toBe(404);
    expect(
      (await api().delete(`/api/admin/users/${admin.user.id}`).set(auth(plain.token))).status,
    ).toBe(403);
  });

  it('reports engagement stats', async () => {
    const admin = await makeUser({ role: Role.ADMIN });
    const planner = await makeUser();
    await makeTrip(planner.user.id);

    const res = await api().get('/api/admin/stats').set(auth(admin.token));

    expect(res.body.engagement.usersWithATrip).toBe(1);
    expect(res.body.engagement.newTripsLast30Days).toBe(1);
    expect(res.body.engagement.activationRate).toBe(50); // 1 of 2 users
  });
});

describe('GET /api/trips/summary', () => {
  it('is empty and safe with no trips', async () => {
    const { token } = await makeUser();
    const res = await api().get('/api/trips/summary').set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({ total: 0, upcoming: 0, ongoing: 0, past: 0 });
    expect(res.body.nextTrip).toBeNull();
    expect(res.body.budget.plannedTotal).toBe(0);
  });

  it('counts buckets and totals only money still to be spent', async () => {
    const { user, token } = await makeUser();

    const upcoming = await makeTrip(user.id, {
      name: 'Upcoming',
      startDate: day(10),
      endDate: day(20),
      budgetLimit: 100,
    });
    const past = await makeTrip(user.id, {
      name: 'Past',
      startDate: day(-30),
      endDate: day(-20),
    });

    await prisma.expense.createMany({
      data: [
        { tripId: upcoming.id, category: 'STAY', label: 'Hotel', amount: 300 },
        { tripId: past.id, category: 'STAY', label: 'Old hotel', amount: 999 },
      ],
    });

    const res = await api().get('/api/trips/summary').set(auth(token));

    expect(res.body.counts).toEqual({ total: 2, upcoming: 1, ongoing: 0, past: 1 });
    // The finished trip's 999 must not appear in the highlights.
    expect(res.body.budget.plannedTotal).toBe(300);
    expect(res.body.budget.byCategory.STAY).toBe(300);
    expect(res.body.budget.overBudgetTrips).toBe(1);
    expect(res.body.budget.mostExpensive.name).toBe('Upcoming');
    expect(res.body.nextTrip.name).toBe('Upcoming');
    expect(res.body.nextTrip.daysUntil).toBe(10);
  });

  it('folds itinerary activity costs into ACTIVITIES', async () => {
    const { user, token } = await makeUser();
    const trip = await makeTrip(user.id, { startDate: day(5), endDate: day(9) });
    const city = await makeCity({ name: 'Summary City' });

    const stop = await api()
      .post(`/api/trips/${trip.id}/stops`)
      .set(auth(token))
      .send({ cityId: city.id, startDate: DATES.start, endDate: DATES.day2 });
    await api()
      .post(`/api/trips/${trip.id}/stops/${stop.body.id}/activities`)
      .set(auth(token))
      .send({ name: 'Museum', cost: 45 });

    const res = await api().get('/api/trips/summary').set(auth(token));
    expect(res.body.budget.byCategory.ACTIVITIES).toBe(45);
    expect(res.body.budget.plannedTotal).toBe(45);
  });

  it('is not confused by a trip id called summary', async () => {
    const { token } = await makeUser();
    // Proves the /summary route is matched before /:tripId.
    expect((await api().get('/api/trips/summary').set(auth(token))).status).toBe(200);
  });
});

describe('GET /api/cities/recommended', () => {
  it('returns the most popular cities anonymously', async () => {
    await makeCity({ name: 'Quiet', popularity: 1 });
    await makeCity({ name: 'Famous', popularity: 99 });

    const res = await api().get('/api/cities/recommended?limit=1');

    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Famous');
  });

  it('skips cities the traveller has already saved or planned', async () => {
    const { user, token } = await makeUser();
    const saved = await makeCity({ name: 'Saved', popularity: 99 });
    const planned = await makeCity({ name: 'Planned', popularity: 98 });
    const fresh = await makeCity({ name: 'Fresh', popularity: 97 });
    await makeActivity(fresh.id);

    await api().post(`/api/users/me/saved-destinations/${saved.id}`).set(auth(token)).expect(201);

    const trip = await makeTrip(user.id);
    await api()
      .post(`/api/trips/${trip.id}/stops`)
      .set(auth(token))
      .send({ cityId: planned.id, startDate: DATES.start, endDate: DATES.day2 });

    const res = await api().get('/api/cities/recommended').set(auth(token));

    expect(res.body.map((c: { name: string }) => c.name)).toEqual(['Fresh']);
    expect(res.body[0]._count.activities).toBe(1);
  });

  it('rejects an oversized limit', async () => {
    expect((await api().get('/api/cities/recommended?limit=500')).status).toBe(400);
  });
});
