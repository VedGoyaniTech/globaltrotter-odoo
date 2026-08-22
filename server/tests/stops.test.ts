import { describe, expect, it } from 'vitest';
import { api, DATES, makeActivity, makeCity, makeTrip, makeUser } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function tripWithStops(count: number) {
  const { user, token } = await makeUser();
  const trip = await makeTrip(user.id);
  const stopIds: string[] = [];
  // Unique per call so two trips in one test don't collide on unique(name, country).
  const tag = Math.random().toString(36).slice(2, 8);

  for (let i = 0; i < count; i++) {
    const city = await makeCity({ name: `City ${tag}-${i}` });
    const res = await api()
      .post(`/api/trips/${trip.id}/stops`)
      .set(auth(token))
      .send({ cityId: city.id, startDate: DATES.start, endDate: DATES.day2 });
    stopIds.push(res.body.id);
  }

  return { user, token, trip, stopIds };
}

describe('stops', () => {
  it('appends stops with an incrementing orderIndex', async () => {
    const { token, trip } = await tripWithStops(3);
    const res = await api().get(`/api/trips/${trip.id}/stops`).set(auth(token));

    expect(res.body.map((s: { orderIndex: number }) => s.orderIndex)).toEqual([0, 1, 2]);
  });

  it('rejects a stop whose endDate precedes its startDate', async () => {
    const { user, token } = await makeUser();
    const trip = await makeTrip(user.id);
    const city = await makeCity();

    const res = await api()
      .post(`/api/trips/${trip.id}/stops`)
      .set(auth(token))
      .send({ cityId: city.id, startDate: DATES.end, endDate: DATES.start });

    expect(res.status).toBe(400);
  });

  it('blocks adding a stop to someone elses trip', async () => {
    const { trip } = await tripWithStops(0);
    const stranger = await makeUser();
    const city = await makeCity();

    const res = await api()
      .post(`/api/trips/${trip.id}/stops`)
      .set(auth(stranger.token))
      .send({ cityId: city.id, startDate: DATES.start, endDate: DATES.day2 });

    expect(res.status).toBe(403);
  });

  it('deletes a stop and its activities', async () => {
    const { token, trip, stopIds } = await tripWithStops(1);
    await api()
      .post(`/api/trips/${trip.id}/stops/${stopIds[0]}/activities`)
      .set(auth(token))
      .send({ name: 'Custom walk', cost: 10 });

    expect(await prisma.tripActivity.count()).toBe(1);
    await api().delete(`/api/trips/${trip.id}/stops/${stopIds[0]}`).set(auth(token)).expect(204);
    expect(await prisma.tripActivity.count()).toBe(0);
  });
});

describe('PUT /api/trips/:id/stops/reorder', () => {
  it('reverses the order without violating the unique index', async () => {
    const { token, trip, stopIds } = await tripWithStops(3);
    const reversed = [...stopIds].reverse();

    const res = await api()
      .put(`/api/trips/${trip.id}/stops/reorder`)
      .set(auth(token))
      .send({ stopIds: reversed });

    expect(res.status).toBe(200);
    expect(res.body.map((s: { id: string }) => s.id)).toEqual(reversed);
    expect(res.body.map((s: { orderIndex: number }) => s.orderIndex)).toEqual([0, 1, 2]);
  });

  it('rejects a partial stop list', async () => {
    const { token, trip, stopIds } = await tripWithStops(3);
    const res = await api()
      .put(`/api/trips/${trip.id}/stops/reorder`)
      .set(auth(token))
      .send({ stopIds: [stopIds[0]] });

    expect(res.status).toBe(400);
  });

  it('rejects ids belonging to another trip', async () => {
    const a = await tripWithStops(2);
    const b = await tripWithStops(2);

    const res = await api()
      .put(`/api/trips/${a.trip.id}/stops/reorder`)
      .set(auth(a.token))
      .send({ stopIds: [a.stopIds[0], b.stopIds[0]] });

    expect(res.status).toBe(400);
  });
});

describe('trip activities', () => {
  it('copies name, cost and duration from a catalogue activity', async () => {
    const { token, trip, stopIds } = await tripWithStops(1);
    const city = await makeCity({ name: 'Oslo' });
    const catalogue = await makeActivity(city.id, {
      name: 'Fjord cruise',
      cost: 75,
      durationMinutes: 210,
    });

    const res = await api()
      .post(`/api/trips/${trip.id}/stops/${stopIds[0]}/activities`)
      .set(auth(token))
      .send({ activityId: catalogue.id });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Fjord cruise');
    expect(Number(res.body.cost)).toBe(75);
    expect(res.body.durationMinutes).toBe(210);
  });

  it('lets an explicit field override the catalogue default', async () => {
    const { token, trip, stopIds } = await tripWithStops(1);
    const city = await makeCity({ name: 'Bergen' });
    const catalogue = await makeActivity(city.id, { name: 'Museum', cost: 30 });

    const res = await api()
      .post(`/api/trips/${trip.id}/stops/${stopIds[0]}/activities`)
      .set(auth(token))
      .send({ activityId: catalogue.id, cost: 0 });

    expect(Number(res.body.cost)).toBe(0);
  });

  it('requires a name for a custom activity', async () => {
    const { token, trip, stopIds } = await tripWithStops(1);
    const res = await api()
      .post(`/api/trips/${trip.id}/stops/${stopIds[0]}/activities`)
      .set(auth(token))
      .send({ cost: 12 });

    expect(res.status).toBe(400);
  });

  it('rejects an unknown activityId', async () => {
    const { token, trip, stopIds } = await tripWithStops(1);
    const res = await api()
      .post(`/api/trips/${trip.id}/stops/${stopIds[0]}/activities`)
      .set(auth(token))
      .send({ activityId: 'nope' });

    expect(res.status).toBe(400);
  });

  it('validates the startTime format', async () => {
    const { token, trip, stopIds } = await tripWithStops(1);
    const res = await api()
      .post(`/api/trips/${trip.id}/stops/${stopIds[0]}/activities`)
      .set(auth(token))
      .send({ name: 'Late dinner', startTime: '25:00' });

    expect(res.status).toBe(400);
  });

  it('will not touch an activity on a stop from another trip', async () => {
    const a = await tripWithStops(1);
    const b = await tripWithStops(1);

    const created = await api()
      .post(`/api/trips/${b.trip.id}/stops/${b.stopIds[0]}/activities`)
      .set(auth(b.token))
      .send({ name: 'Bobs activity' });

    const res = await api()
      .delete(`/api/trips/${a.trip.id}/stops/${a.stopIds[0]}/activities/${created.body.id}`)
      .set(auth(a.token));

    expect(res.status).toBe(404);
  });
});

describe('per-stop budget', () => {
  it('accepts a budget on create and clears it with null', async () => {
    const { user, token } = await makeUser();
    const trip = await makeTrip(user.id);
    const city = await makeCity({ name: 'Bruges' });

    const created = await api()
      .post(`/api/trips/${trip.id}/stops`)
      .set(auth(token))
      .send({ cityId: city.id, startDate: DATES.start, endDate: DATES.day2, budget: 450 });

    expect(created.status).toBe(201);
    expect(Number(created.body.budget)).toBe(450);

    const cleared = await api()
      .patch(`/api/trips/${trip.id}/stops/${created.body.id}`)
      .set(auth(token))
      .send({ budget: null });

    expect(cleared.body.budget).toBeNull();
  });

  it('rejects a negative budget', async () => {
    const { user, token } = await makeUser();
    const trip = await makeTrip(user.id);
    const city = await makeCity({ name: 'Ghent Two' });

    const res = await api()
      .post(`/api/trips/${trip.id}/stops`)
      .set(auth(token))
      .send({ cityId: city.id, startDate: DATES.start, endDate: DATES.day2, budget: -1 });

    expect(res.status).toBe(400);
  });
});

describe('PUT .../activities/reorder', () => {
  async function stopWithActivities(count: number) {
    const { token, trip, stopIds } = await tripWithStops(1);
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const res = await api()
        .post(`/api/trips/${trip.id}/stops/${stopIds[0]}/activities`)
        .set(auth(token))
        .send({ name: `Activity ${i}` });
      ids.push(res.body.id);
    }
    return { token, trip, stopId: stopIds[0], ids };
  }

  it('reverses activity order within a stop', async () => {
    const { token, trip, stopId, ids } = await stopWithActivities(3);
    const reversed = [...ids].reverse();

    const res = await api()
      .put(`/api/trips/${trip.id}/stops/${stopId}/activities/reorder`)
      .set(auth(token))
      .send({ activityIds: reversed });

    expect(res.status).toBe(200);
    expect(res.body.map((a: { id: string }) => a.id)).toEqual(reversed);
    expect(res.body.map((a: { orderIndex: number }) => a.orderIndex)).toEqual([0, 1, 2]);
  });

  it('rejects a partial list', async () => {
    const { token, trip, stopId, ids } = await stopWithActivities(3);
    const res = await api()
      .put(`/api/trips/${trip.id}/stops/${stopId}/activities/reorder`)
      .set(auth(token))
      .send({ activityIds: [ids[0]] });

    expect(res.status).toBe(400);
  });

  it('rejects ids from another stop', async () => {
    const a = await stopWithActivities(2);
    const b = await stopWithActivities(2);

    const res = await api()
      .put(`/api/trips/${a.trip.id}/stops/${a.stopId}/activities/reorder`)
      .set(auth(a.token))
      .send({ activityIds: [a.ids[0], b.ids[0]] });

    expect(res.status).toBe(400);
  });

  it('is blocked for a non-owner', async () => {
    const { trip, stopId, ids } = await stopWithActivities(2);
    const stranger = await makeUser();

    const res = await api()
      .put(`/api/trips/${trip.id}/stops/${stopId}/activities/reorder`)
      .set(auth(stranger.token))
      .send({ activityIds: ids });

    expect(res.status).toBe(403);
  });
});
