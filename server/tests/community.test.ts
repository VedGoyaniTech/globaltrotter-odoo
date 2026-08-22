import { describe, expect, it } from 'vitest';
import { api, DATES, makeCity, makeTrip, makeUser } from './helpers.js';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Creates a trip with one stop and optionally publishes it. */
async function tripWith(
  opts: { name: string; city: string; country: string; isPublic: boolean; owner?: string },
) {
  const { user, token } = await makeUser({ name: opts.owner ?? 'Owner' });
  const trip = await makeTrip(user.id, { name: opts.name });
  const city = await makeCity({ name: opts.city, country: opts.country });

  await api()
    .post(`/api/trips/${trip.id}/stops`)
    .set(auth(token))
    .send({ cityId: city.id, startDate: DATES.start, endDate: DATES.day2 });

  if (opts.isPublic) {
    await api().post(`/api/trips/${trip.id}/share`).set(auth(token)).send({ isPublic: true });
  }
  return { user, token, trip };
}

describe('GET /api/public/trips', () => {
  it('lists only published itineraries, anonymously', async () => {
    await tripWith({ name: 'Shared Alps', city: 'Innsbruck', country: 'Austria', isPublic: true });
    await tripWith({ name: 'Private Draft', city: 'Graz', country: 'Austria', isPublic: false });

    const res = await api().get('/api/public/trips');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].name).toBe('Shared Alps');
  });

  it('returns a card-shaped payload without leaking the owner id linkage', async () => {
    await tripWith({ name: 'Coast Run', city: 'Split', country: 'Croatia', isPublic: true, owner: 'Mara' });

    const [item] = (await api().get('/api/public/trips')).body.items;

    expect(item.publicSlug).toBeTypeOf('string');
    expect(item.stopCount).toBe(1);
    expect(item.cities).toEqual([expect.objectContaining({ name: 'Split', country: 'Croatia' })]);
    expect(item.user.name).toBe('Mara');
    expect(item.user).not.toHaveProperty('email');
    // The raw stop rows and the owner FK are not part of the feed payload.
    expect(item.stops).toBeUndefined();
    expect(item.userId).toBeUndefined();
  });

  it('searches the trip name', async () => {
    await tripWith({ name: 'Ramen Pilgrimage', city: 'Fukuoka', country: 'Japan', isPublic: true });
    await tripWith({ name: 'Fjord Loop', city: 'Bergen', country: 'Norway', isPublic: true });

    const res = await api().get('/api/public/trips?q=ramen');
    expect(res.body.items.map((t: { name: string }) => t.name)).toEqual(['Ramen Pilgrimage']);
  });

  it('searches by a city on the itinerary, not just the trip name', async () => {
    await tripWith({ name: 'Unrelated Title', city: 'Lucerne', country: 'Switzerland', isPublic: true });
    await tripWith({ name: 'Other', city: 'Porto', country: 'Portugal', isPublic: true });

    const res = await api().get('/api/public/trips?q=lucerne');
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].name).toBe('Unrelated Title');
  });

  it('filters by country', async () => {
    await tripWith({ name: 'A', city: 'Kyoto', country: 'Japan', isPublic: true });
    await tripWith({ name: 'B', city: 'Hanoi', country: 'Vietnam', isPublic: true });

    const res = await api().get('/api/public/trips?country=japan');
    expect(res.body.total).toBe(1);
  });

  it('paginates', async () => {
    for (let i = 0; i < 5; i++) {
      await tripWith({ name: `Trip ${i}`, city: `Town ${i}`, country: 'Testland', isPublic: true });
    }

    const res = await api().get('/api/public/trips?limit=2&page=3');
    expect(res.body.items).toHaveLength(1);
    expect(res.body.pages).toBe(3);
  });

  it('drops a trip from the feed once sharing is switched off', async () => {
    const { token, trip } = await tripWith({
      name: 'Temporary', city: 'Tallinn', country: 'Estonia', isPublic: true,
    });
    expect((await api().get('/api/public/trips')).body.total).toBe(1);

    await api().post(`/api/trips/${trip.id}/share`).set(auth(token)).send({ isPublic: false });
    expect((await api().get('/api/public/trips')).body.total).toBe(0);
  });

  it('sorts by soonest departure', async () => {
    const a = await tripWith({ name: 'Later', city: 'Oslo', country: 'Norway', isPublic: true });
    const b = await tripWith({ name: 'Sooner', city: 'Nice', country: 'France', isPublic: true });
    await api().patch(`/api/trips/${a.trip.id}`).set(auth(a.token))
      .send({ startDate: '2027-01-01', endDate: '2027-01-10' });
    await api().patch(`/api/trips/${b.trip.id}`).set(auth(b.token))
      .send({ startDate: '2026-01-01', endDate: '2026-01-10' });

    const res = await api().get('/api/public/trips?sort=soonest');
    expect(res.body.items.map((t: { name: string }) => t.name)).toEqual(['Sooner', 'Later']);
  });

  it('rejects an unknown sort value', async () => {
    expect((await api().get('/api/public/trips?sort=vibes')).status).toBe(400);
  });
});

describe('GET /api/public/countries', () => {
  it('counts distinct cities per country across published trips only', async () => {
    await tripWith({ name: 'A', city: 'Lisbon', country: 'Portugal', isPublic: true });
    await tripWith({ name: 'B', city: 'Porto', country: 'Portugal', isPublic: true });
    await tripWith({ name: 'C', city: 'Madrid', country: 'Spain', isPublic: false });

    const res = await api().get('/api/public/countries');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ country: 'Portugal', cities: 2 }]);
  });
});
