import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';

const health = async () => ({ status: 'ok', redis: 'up', temporal: 'up', suppliers: { supplierA: 'up', supplierB: 'up' } });
const setup = () => {
  const search = vi.fn().mockResolvedValue([]);
  return { search, app: createApp({ search, health, supplierADown: false, supplierBDown: false }) };
};

describe('HTTP API', () => {
  it.each(['', '?city=', '?city=delhi&minPrice=-1', '?city=delhi&minPrice=10&maxPrice=1',
    '?city=delhi&maxPrice=abc', '?city=delhi&city=mumbai', '?city=delhi&minPrice=',
    '?city=delhi&maxPrice=Infinity', '?city=delhi&maxPrice=1.234'])('rejects invalid query %s before starting a workflow', async query => {
    const { app, search } = setup();
    expect((await request(app).get(`/api/hotels${query}`)).status).toBe(400);
    expect(search).not.toHaveBeenCalled();
  });
  it('normalizes city and passes inclusive bounds, including zero', async () => {
    const { app, search } = setup();
    const response = await request(app).get('/api/hotels?city=%20Delhi%20&minPrice=0&maxPrice=5340');
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(search).toHaveBeenCalledWith({ city: 'delhi', minPrice: 0, maxPrice: 5340 }, expect.any(String));
  });
  it('does not expose internal failure details', async () => {
    const { app, search } = setup();
    search.mockRejectedValue(new Error('internal details'));
    const response = await request(app).get('/api/hotels?city=delhi');
    expect(response.status).toBe(503);
    expect(JSON.stringify(response.body)).not.toContain('internal details');
  });
  it('provides city-filtered mocks and health', async () => {
    const { app } = setup();
    const response = await request(app).get('/supplierA/hotels?city=delhi');
    expect(response.body).toHaveLength(3);
    expect((await request(app).get('/supplierB/hotels?city=unknown')).body).toEqual([]);
    expect((await request(app).get('/health')).body.suppliers).toEqual({ supplierA: 'up', supplierB: 'up' });
  });
  it('simulates a supplier outage and reports degraded health', async () => {
    const app = createApp({ search: vi.fn(), supplierADown: false, supplierBDown: true,
      health: async () => ({ ...await health(), status: 'degraded', suppliers: { supplierA: 'up', supplierB: 'down' } }),
    });
    expect((await request(app).get('/supplierB/hotels')).status).toBe(503);
    expect((await request(app).get('/health')).status).toBe(503);
  });
});
