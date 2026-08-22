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
    const res = await api()
      .post('/api/trips')
      .send({ name: 'X', startDate: DATES.start, endDate: DATES.end });
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

    expect((await api().delete(`/api/trips/${trip.id}`).set(auth(stranger.token))).status).toBe(
      403,
    );
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

    const on = await api()
      .post(`/api/trips/${trip.id}/share`)
      .set(auth(token))
      .send({ isPublic: true });
    expect(on.status).toBe(200);
    expect(on.body.publicSlug).toBeTypeOf('string');

    const off = await api()
      .post(`/api/trips/${trip.id}/share`)
      .set(auth(token))
      .send({ isPublic: false });
    expect(off.body.isPublic).toBe(false);

    const again = await api()
      .post(`/api/trips/${trip.id}/share`)
      .set(auth(token))
      .send({ isPublic: true });
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

describe('PATCH date-range validation', () => {
  it('rejects a partial update that would invert the trip range', async () => {
    const { user, token } = await makeUser();
    const trip = await makeTrip(user.id); // 2026-06-01 .. 2026-06-05

    // Only startDate is sent, so the schema-level refine cannot catch this.
    const res = await api()
      .patch(`/api/trips/${trip.id}`)
      .set(auth(token))
      .send({ startDate: '2026-06-10' });

    expect(res.status).toBe(400);
    expect(res.body.details.body[0].path).toBe('endDate');
  });

  it('allows a partial update that keeps the range valid', async () => {
    const { user, token } = await makeUser();
    const trip = await makeTrip(user.id);

    const res = await api()
      .patch(`/api/trips/${trip.id}`)
      .set(auth(token))
      .send({ startDate: '2026-06-02' });

    expect(res.status).toBe(200);
  });

  it('rejects a partial update that would invert a stop range', async () => {
    const { user, token } = await makeUser();
    const trip = await makeTrip(user.id);
    const city = await makeCity({ name: 'Ghent' });

    const stop = await api()
      .post(`/api/trips/${trip.id}/stops`)
      .set(auth(token))
      .send({ cityId: city.id, startDate: DATES.start, endDate: DATES.day2 });

    const res = await api()
      .patch(`/api/trips/${trip.id}/stops/${stop.body.id}`)
      .set(auth(token))
      .send({ startDate: '2026-06-04' });

    expect(res.status).toBe(400);
  });
});

describe('trip list buckets', () => {
  /** Builds a trip spanning today+from .. today+to. */
  async function tripSpanning(userId: string, name: string, from: number, to: number) {
    const day = (offset: number) => {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() + offset);
      return d;
    };
    return makeTrip(userId, { name, startDate: day(from), endDate: day(to) });
  }

  it('splits ongoing, upcoming and past into disjoint buckets', async () => {
    const { user, token } = await makeUser();
    await tripSpanning(user.id, 'Happening now', -2, 2);
    await tripSpanning(user.id, 'Starts later', 10, 20);
    await tripSpanning(user.id, 'Already done', -20, -10);

    const names = async (filter: string) =>
      (await api().get(`/api/trips?filter=${filter}`).set(auth(token))).body.items.map(
        (t: { name: string }) => t.name,
      );

    expect(await names('ongoing')).toEqual(['Happening now']);
    expect(await names('upcoming')).toEqual(['Starts later']);
    expect(await names('past')).toEqual(['Already done']);
    expect((await names('all')).sort()).toHaveLength(3);
  });

  it('counts a trip starting today as ongoing, not upcoming', async () => {
    const { user, token } = await makeUser();
    await tripSpanning(user.id, 'Starts today', 0, 3);

    const upcoming = await api().get('/api/trips?filter=upcoming').set(auth(token));
    const ongoing = await api().get('/api/trips?filter=ongoing').set(auth(token));

    expect(upcoming.body.total).toBe(0);
    expect(ongoing.body.total).toBe(1);
  });

  it('rejects an unknown filter', async () => {
    const { token } = await makeUser();
    expect((await api().get('/api/trips?filter=someday').set(auth(token))).status).toBe(400);
  });
});

describe('trip list payload', () => {
  it('carries per-stop activity ids so cards can count experiences', async () => {
    const { user, token } = await makeUser();
    const trip = await makeTrip(user.id);
    const city = await makeCity({ name: 'Porto Card' });

    const stop = await api()
      .post(`/api/trips/${trip.id}/stops`)
      .set(auth(token))
      .send({ cityId: city.id, startDate: DATES.start, endDate: DATES.day2 });

    for (const name of ['Port tasting', 'River walk']) {
      await api()
        .post(`/api/trips/${trip.id}/stops/${stop.body.id}/activities`)
        .set(auth(token))
        .send({ name });
    }

    const [listed] = (await api().get('/api/trips').set(auth(token))).body.items;

    expect(listed.stops).toHaveLength(1);
    expect(listed.stops[0].city.name).toBe('Porto Card');
    // The dashboard sums this; without it every card reported zero.
    expect(listed.stops[0].activities).toHaveLength(2);
  });
});
