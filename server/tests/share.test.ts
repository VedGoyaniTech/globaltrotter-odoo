import { describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { api, DATES, makeCity, makeTrip, makeUser } from './helpers.js';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function publicTrip() {
  const { user, token } = await makeUser({ name: 'Owner' });
  const trip = await makeTrip(user.id, { name: 'Shared Loop' });
  const city = await makeCity({ name: 'Seville', country: 'Spain' });

  const stop = await api()
    .post(`/api/trips/${trip.id}/stops`)
    .set(auth(token))
    .send({ cityId: city.id, startDate: DATES.start, endDate: DATES.day2 });

  await api()
    .post(`/api/trips/${trip.id}/stops/${stop.body.id}/activities`)
    .set(auth(token))
    .send({ name: 'Flamenco show', cost: 40, scheduledDate: DATES.day2 });

  await api()
    .post(`/api/trips/${trip.id}/budget/expenses`)
    .set(auth(token))
    .send({ category: 'STAY', label: 'Hostel', amount: 200 });

  const share = await api()
    .post(`/api/trips/${trip.id}/share`)
    .set(auth(token))
    .send({ isPublic: true });

  return { owner: user, token, trip, slug: share.body.publicSlug as string };
}

describe('GET /api/public/trips/:slug', () => {
  it('serves a public trip anonymously with day-by-day data', async () => {
    const { slug } = await publicTrip();
    const res = await api().get(`/api/public/trips/${slug}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Shared Loop');
    expect(res.body.days).toHaveLength(5);
    expect(res.body.user.name).toBe('Owner');
    // The owner's internal id must not leak on the public payload.
    expect(res.body.userId).toBeUndefined();
  });

  it('404s once sharing is switched off', async () => {
    const { token, trip, slug } = await publicTrip();
    await api().post(`/api/trips/${trip.id}/share`).set(auth(token)).send({ isPublic: false });

    expect((await api().get(`/api/public/trips/${slug}`)).status).toBe(404);
  });

  it('404s for an unknown slug', async () => {
    expect((await api().get('/api/public/trips/nope')).status).toBe(404);
  });
});

describe('POST /api/public/trips/:slug/copy', () => {
  it('requires authentication', async () => {
    const { slug } = await publicTrip();
    expect((await api().post(`/api/public/trips/${slug}/copy`)).status).toBe(401);
  });

  it('deep-copies stops, activities and expenses to the caller', async () => {
    const { slug, owner } = await publicTrip();
    const copier = await makeUser({ name: 'Copier' });

    const res = await api().post(`/api/public/trips/${slug}/copy`).set(auth(copier.token));

    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(copier.user.id);
    expect(res.body.userId).not.toBe(owner.id);
    expect(res.body.name).toBe('Shared Loop (copy)');
    expect(res.body.isPublic).toBe(false);
    expect(res.body.publicSlug).toBeNull();
    expect(res.body.stops).toHaveLength(1);
    expect(res.body.stops[0].activities[0].name).toBe('Flamenco show');
    expect(res.body.expenses).toHaveLength(1);

    // The copy is independent - editing it must not touch the original.
    await api()
      .delete(`/api/trips/${res.body.id}/stops/${res.body.stops[0].id}`)
      .set(auth(copier.token))
      .expect(204);

    const original = await api().get(`/api/public/trips/${slug}`);
    expect(original.body.stops).toHaveLength(1);
  });
});

describe('/api/admin', () => {
  it('rejects anonymous and non-admin callers', async () => {
    const plain = await makeUser();
    expect((await api().get('/api/admin/stats')).status).toBe(401);
    expect((await api().get('/api/admin/stats').set(auth(plain.token))).status).toBe(403);
  });

  it('returns platform stats for an admin', async () => {
    await publicTrip();
    const admin = await makeUser({ role: Role.ADMIN });

    const res = await api().get('/api/admin/stats').set(auth(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.counts.trips).toBe(1);
    expect(res.body.counts.publicTrips).toBe(1);
    expect(res.body.topCities[0].name).toBe('Seville');
    expect(res.body.topActivities[0]).toEqual({ name: 'Flamenco show', uses: 1 });
  });
});

describe('/api/users/me', () => {
  it('updates the profile', async () => {
    const { token } = await makeUser();
    const res = await api()
      .patch('/api/users/me')
      .set(auth(token))
      .send({ name: 'Renamed', language: 'hi' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed');
    expect(res.body.language).toBe('hi');
  });

  it('rejects an invalid avatar url', async () => {
    const { token } = await makeUser();
    const res = await api().patch('/api/users/me').set(auth(token)).send({ avatarUrl: 'not-a-url' });
    expect(res.status).toBe(400);
  });

  it('saves and unsaves a destination without duplicating', async () => {
    const { token } = await makeUser();
    const city = await makeCity({ name: 'Hanoi' });

    await api().post(`/api/users/me/saved-destinations/${city.id}`).set(auth(token)).expect(201);
    await api().post(`/api/users/me/saved-destinations/${city.id}`).set(auth(token)).expect(201);

    let saved = await api().get('/api/users/me/saved-destinations').set(auth(token));
    expect(saved.body).toHaveLength(1);

    await api().delete(`/api/users/me/saved-destinations/${city.id}`).set(auth(token)).expect(204);
    saved = await api().get('/api/users/me/saved-destinations').set(auth(token));
    expect(saved.body).toHaveLength(0);
  });

  it('deletes the account and cascades its trips', async () => {
    const { user, token } = await makeUser();
    await makeTrip(user.id);

    await api().delete('/api/users/me').set(auth(token)).expect(204);
    expect((await api().get('/api/auth/me').set(auth(token))).status).toBe(404);
  });
});
