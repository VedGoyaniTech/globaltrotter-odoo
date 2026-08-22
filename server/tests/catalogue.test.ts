import { describe, expect, it } from 'vitest';
import { ActivityCategory } from '@prisma/client';
import { api, makeActivity, makeCity } from './helpers.js';

describe('GET /api/cities', () => {
  it('searches by name, case-insensitively', async () => {
    await makeCity({ name: 'Porto', country: 'Portugal' });
    await makeCity({ name: 'Oporto Beach', country: 'Portugal' });
    await makeCity({ name: 'Berlin', country: 'Germany' });

    const res = await api().get('/api/cities?q=porto');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  it('filters by country and sorts by cost index', async () => {
    await makeCity({ name: 'Cheap', country: 'Testland', costIndex: 40 });
    await makeCity({ name: 'Pricey', country: 'Testland', costIndex: 160 });
    await makeCity({ name: 'Elsewhere', country: 'Otherland', costIndex: 10 });

    const res = await api().get('/api/cities?country=testland&sort=costIndex');
    expect(res.body.items.map((c: { name: string }) => c.name)).toEqual(['Cheap', 'Pricey']);
  });

  it('paginates', async () => {
    for (let i = 0; i < 5; i++) await makeCity({ name: `Paged ${i}`, popularity: i });

    const res = await api().get('/api/cities?limit=2&page=2');
    expect(res.body.items).toHaveLength(2);
    expect(res.body.pages).toBe(3);
  });

  it('rejects an out-of-range limit', async () => {
    expect((await api().get('/api/cities?limit=999')).status).toBe(400);
  });

  it('404s for an unknown city', async () => {
    expect((await api().get('/api/cities/nope')).status).toBe(404);
  });
});

describe('GET /api/activities', () => {
  it('filters by city, category and max cost', async () => {
    const rome = await makeCity({ name: 'Rome' });
    const oslo = await makeCity({ name: 'Oslo' });

    await makeActivity(rome.id, {
      name: 'Cheap food tour',
      cost: 20,
      category: ActivityCategory.FOOD,
    });
    await makeActivity(rome.id, {
      name: 'Pricey food tour',
      cost: 200,
      category: ActivityCategory.FOOD,
    });
    await makeActivity(rome.id, {
      name: 'Ruins walk',
      cost: 5,
      category: ActivityCategory.CULTURE,
    });
    await makeActivity(oslo.id, { name: 'Fjord', cost: 10, category: ActivityCategory.FOOD });

    const res = await api().get(`/api/activities?cityId=${rome.id}&category=FOOD&maxCost=50`);
    expect(res.body.items.map((a: { name: string }) => a.name)).toEqual(['Cheap food tour']);
  });

  it('rejects an unknown category', async () => {
    expect((await api().get('/api/activities?category=NAPPING')).status).toBe(400);
  });

  it('lists the category enum for filter chips', async () => {
    const res = await api().get('/api/activities/categories');
    expect(res.body).toContain('ADVENTURE');
  });
});

describe('GET /api/health', () => {
  it('reports ok', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('unknown routes', () => {
  it('404 with a JSON body', async () => {
    const res = await api().get('/api/not-a-route');
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('not found');
  });
});
