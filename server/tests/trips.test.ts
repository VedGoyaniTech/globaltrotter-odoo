import { describe, expect, it } from 'vitest';
import { api, DATES, makeCity, makeTrip, makeUser } from './helpers.js';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('POST /api/trips', () => {
  it('creates a trip', async () => {
    const { token } = await makeUser();
    const res = await api()
      .post('/api/trips')
      .set(auth(token))
      .send({ name: 'Euro Loop', startDate: DATES.start, endDate: DATES.end, budgetLimit: 1000 });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Euro Loop');
    expect(res.body.stops).toEqual([]);
  });

  it('rejects an endDate before the startDate', async () => {
    const { token } = await makeUser();
    const res = await api()
      .post('/api/trips')
      .set(auth(token))
      .send({ name: 'Backwards', startDate: DATES.end, endDate: DATES.start });

    expect(res.status).toBe(400);
    expect(res.body.details.body[0].path).toBe('endDate');
  });

  it('rejects a non-ISO date', async () => {
    const { token } = await makeUser();
    const res = await api()
      .post('/api/trips')
      .set(auth(token))
      .send({ name: 'Bad date', startDate: '01/06/2026', endDate: DATES.end });

    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await api().post('/api/trips').send({ name: 'X', startDate: DATES.start, endDate: DATES.end });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/trips', () => {
  it('only lists the callers own trips', async () => {
    const alice = await makeUser();
    const bob = await makeUser();
    await makeTrip(alice.user.id, { name: 'Alice trip' });
    await makeTrip(bob.user.id, { name: 'Bob trip' });

    const res = await api().get('/api/trips').set(auth(alice.token));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].name).toBe('Alice trip');
  });

  it('splits upcoming and past by end date', async () => {
    const { user, token } = await makeUser();
    await makeTrip(user.id, {
      name: 'Last year',
      startDate: new Date('2020-01-01T00:00:00.000Z'),
      endDate: new Date('2020-01-05T00:00:00.000Z'),
    });
    await makeTrip(user.id, {
      name: 'Next year',
      startDate: new Date('2030-01-01T00:00:00.000Z'),
      endDate: new Date('2030-01-05T00:00:00.000Z'),
    });

    const past = await api().get('/api/trips?filter=past').set(auth(token));
    const upcoming = await api().get('/api/trips?filter=upcoming').set(auth(token));

    expect(past.body.items.map((t: { name: string }) => t.name)).toEqual(['Last year']);
    expect(upcoming.body.items.map((t: { name: string }) => t.name)).toEqual(['Next year']);
  });

  it('filters by name with ?q', async () => {
    const { user, token } = await makeUser();
    await makeTrip(user.id, { name: 'Tokyo Winter' });
    await makeTrip(user.id, { name: 'Paris Spring' });

    const res = await api().get('/api/trips?q=tokyo').set(auth(token));
    expect(res.body.total).toBe(1);
  });
});

describe('trip ownership', () => {
  it('returns 403 when reading another users trip', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const trip = await makeTrip(owner.user.id);

    const res = await api().get(`/api/trips/${trip.id}`).set(auth(stranger.token));
    expect(res.status).toBe(403);
  });

  it('returns 403 when deleting another users trip', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const trip = await makeTrip(owner.user.id);

    expect((await api().delete(`/api/trips/${trip.id}`).set(auth(stranger.token))).status).toBe(403);
    expect((await api().delete(`/api/trips/${trip.id}`).set(auth(owner.token))).status).toBe(204);
  });

  it('returns 404 for an unknown trip', async () => {
    const { token } = await makeUser();
    const res = await api().get('/api/trips/does-not-exist').set(auth(token));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/trips/:id/share', () => {
  it('mints a slug once and keeps it stable across toggles', async () => {
    const { user, token } = await makeUser();
    const trip = await makeTrip(user.id);

    const on = await api().post(`/api/trips/${trip.id}/share`).set(auth(token)).send({ isPublic: true });
    expect(on.status).toBe(200);
    expect(on.body.publicSlug).toBeTypeOf('string');

    const off = await api().post(`/api/trips/${trip.id}/share`).set(auth(token)).send({ isPublic: false });
    expect(off.body.isPublic).toBe(false);

    const again = await api().post(`/api/trips/${trip.id}/share`).set(auth(token)).send({ isPublic: true });
    expect(again.body.publicSlug).toBe(on.body.publicSlug);
  });
});

describe('GET /api/trips/:id/timeline', () => {
  it('returns one entry per calendar day with the city filled in', async () => {
    const { user, token } = await makeUser();
    const trip = await makeTrip(user.id);
    const city = await makeCity({ name: 'Lisbon', country: 'Portugal' });

    await api()
      .post(`/api/trips/${trip.id}/stops`)
      .set(auth(token))
      .send({ cityId: city.id, startDate: DATES.start, endDate: DATES.day2 });

    const res = await api().get(`/api/trips/${trip.id}/timeline`).set(auth(token));

    // 2026-06-01 .. 2026-06-05 inclusive
    expect(res.body.days).toHaveLength(5);
    expect(res.body.days[0].date).toBe(DATES.start);
    expect(res.body.days[0].cityName).toBe('Lisbon, Portugal');
    // Day 3 falls outside the only stop.
    expect(res.body.days[2].cityName).toBeNull();
  });
});
