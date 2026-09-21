import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from 'redis';
import { saveAndFilter } from '../src/redis';
import { randomUUID } from 'node:crypto';

const base = process.env.API_BASE_URL || 'http://localhost:3000';
const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
beforeAll(async () => { await redis.connect(); });
afterAll(async () => { if (redis.isOpen) await redis.quit(); });

describe('running API + Temporal worker + Redis', () => {
  it('returns the expected winners through a real workflow and persists the full list', async () => {
    const response = await fetch(`${base}/api/hotels?city=delhi`);
    expect(response.status).toBe(200);
    const offers = await response.json();
    expect(offers.map((o: { price: number }) => o.price)).toEqual([3200, 5340, 5900, 8100]);
    expect(offers[1]).toEqual({ name: 'Holtin', price: 5340, supplier: 'Supplier B', commissionPct: 20 });
    const key = `hotels:delhi:hotel-search-${response.headers.get('x-request-id')}`;
    expect(await redis.zCard(key)).toBe(4);
    expect(await redis.ttl(key)).toBeGreaterThan(0);
  });
  it('filters inclusively while retaining all offers in Redis', async () => {
    const response = await fetch(`${base}/api/hotels?city=delhi&minPrice=5340&maxPrice=5900`);
    expect(response.status).toBe(200);
    expect((await response.json()).map((o: { name: string }) => o.name)).toEqual(['Holtin', 'Radison']);
    expect(await redis.zCard(`hotels:delhi:hotel-search-${response.headers.get('x-request-id')}`)).toBe(4);
  });
  it.each(['city=unknown', 'city=delhi&maxPrice=0', 'city=delhi&minPrice=9000'])('returns an empty array for %s', async query => {
    const response = await fetch(`${base}/api/hotels?${query}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
  it('isolates concurrent cities and ranges', async () => {
    const [delhi, mumbai] = await Promise.all([
      fetch(`${base}/api/hotels?city=delhi&maxPrice=5340`).then(r => r.json()),
      fetch(`${base}/api/hotels?city=mumbai`).then(r => r.json()),
    ]);
    expect(delhi.map((o: { price: number }) => o.price)).toEqual([3200, 5340]);
    expect(mumbai.map((o: { price: number }) => o.price)).toEqual([7100]);
  });
  it('retries snapshot writes idempotently and clears empty snapshots', async () => {
    const id = randomUUID();
    const offers = [{ name: 'Free Stay', price: 0, supplier: 'Supplier A' as const, commissionPct: 0 }];
    const query = { city: 'test', minPrice: 0, maxPrice: 0 };
    expect(await saveAndFilter(redis, id, offers, query, 60)).toEqual(offers);
    expect(await saveAndFilter(redis, id, offers, query, 60)).toEqual(offers);
    expect(await redis.zCard(`hotels:test:${id}`)).toBe(1);
    expect(await saveAndFilter(redis, id, [], query, 60)).toEqual([]);
    expect(await redis.exists(`hotels:test:${id}`)).toBe(0);
  });
  it('reports both suppliers and infrastructure health', async () => {
    const response = await fetch(`${base}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', redis: 'up', temporal: 'up', suppliers: { supplierA: 'up', supplierB: 'up' } });
  });
});
