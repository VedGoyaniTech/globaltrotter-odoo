import { describe, expect, it } from 'vitest';
import { api, DATES, makeCity, makeTrip, makeUser } from './helpers.js';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function setup(budgetLimit?: number) {
  const { user, token } = await makeUser();
  const trip = await makeTrip(user.id, budgetLimit ? { budgetLimit } : {});
  const city = await makeCity({ name: 'Vienna' });

  const stop = await api()
    .post(`/api/trips/${trip.id}/stops`)
    .set(auth(token))
    .send({ cityId: city.id, startDate: DATES.start, endDate: DATES.day2 });

  return { token, trip, stopId: stop.body.id as string };
}

describe('GET /api/trips/:id/budget', () => {
  it('is all zeroes for an empty trip', async () => {
    const { token, trip } = await setup();
    const res = await api().get(`/api/trips/${trip.id}/budget`).set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.days).toBe(5);
    expect(res.body.overBudget).toBe(false);
  });

  it('derives ACTIVITIES from the itinerary and adds manual expenses on top', async () => {
    const { token, trip, stopId } = await setup();

    await api()
      .post(`/api/trips/${trip.id}/stops/${stopId}/activities`)
      .set(auth(token))
      .send({ name: 'Opera', cost: 120, scheduledDate: DATES.day2 });
    await api()
      .post(`/api/trips/${trip.id}/stops/${stopId}/activities`)
      .set(auth(token))
      .send({ name: 'Coffee house', cost: 30, scheduledDate: DATES.day2 });

    await api()
      .post(`/api/trips/${trip.id}/budget/expenses`)
      .set(auth(token))
      .send({ category: 'STAY', label: 'Hotel', amount: 400 });
    await api()
      .post(`/api/trips/${trip.id}/budget/expenses`)
      .set(auth(token))
      .send({ category: 'ACTIVITIES', label: 'Museum pass', amount: 50 });

    const res = await api().get(`/api/trips/${trip.id}/budget`).set(auth(token));

    expect(res.body.totals.ACTIVITIES).toBe(200); // 120 + 30 from itinerary + 50 manual
    expect(res.body.totals.STAY).toBe(400);
    expect(res.body.totals.MEALS).toBe(0);
    expect(res.body.total).toBe(600);
    expect(res.body.averagePerDay).toBe(120); // 600 / 5 days
  });

  it('flags overBudget only once the limit is passed', async () => {
    const { token, trip } = await setup(100);

    await api()
      .post(`/api/trips/${trip.id}/budget/expenses`)
      .set(auth(token))
      .send({ category: 'MEALS', label: 'Food', amount: 100 });
    let res = await api().get(`/api/trips/${trip.id}/budget`).set(auth(token));
    expect(res.body.overBudget).toBe(false); // exactly at the limit

    await api()
      .post(`/api/trips/${trip.id}/budget/expenses`)
      .set(auth(token))
      .send({ category: 'MEALS', label: 'Dessert', amount: 1 });
    res = await api().get(`/api/trips/${trip.id}/budget`).set(auth(token));
    expect(res.body.overBudget).toBe(true);
  });

  it('marks days above the average', async () => {
    const { token, trip, stopId } = await setup();

    await api()
      .post(`/api/trips/${trip.id}/stops/${stopId}/activities`)
      .set(auth(token))
      .send({ name: 'Big day out', cost: 500, scheduledDate: DATES.day2 });

    const res = await api().get(`/api/trips/${trip.id}/budget`).set(auth(token));
    const heavy = res.body.perDay.find((d: { date: string }) => d.date === DATES.day2);

    expect(heavy.total).toBe(500);
    expect(heavy.overAverage).toBe(true);
    expect(res.body.perDay.filter((d: { overAverage: boolean }) => d.overAverage)).toHaveLength(1);
  });
});

describe('expenses', () => {
  it('rejects an unknown category', async () => {
    const { token, trip } = await setup();
    const res = await api()
      .post(`/api/trips/${trip.id}/budget/expenses`)
      .set(auth(token))
      .send({ category: 'YACHTS', label: 'Yacht', amount: 10 });

    expect(res.status).toBe(400);
  });

  it('rejects a negative amount', async () => {
    const { token, trip } = await setup();
    const res = await api()
      .post(`/api/trips/${trip.id}/budget/expenses`)
      .set(auth(token))
      .send({ category: 'OTHER', label: 'Refund', amount: -5 });

    expect(res.status).toBe(400);
  });

  it('will not update an expense on another users trip', async () => {
    const a = await setup();
    const stranger = await makeUser();

    const created = await api()
      .post(`/api/trips/${a.trip.id}/budget/expenses`)
      .set(auth(a.token))
      .send({ category: 'OTHER', label: 'Souvenirs', amount: 20 });

    const res = await api()
      .patch(`/api/trips/${a.trip.id}/budget/expenses/${created.body.id}`)
      .set(auth(stranger.token))
      .send({ amount: 0 });

    expect(res.status).toBe(403);
  });
});
