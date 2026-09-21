import assert from 'node:assert/strict';

const base = process.env.API_BASE_URL || process.argv[2];
if (!base) throw new Error('Set API_BASE_URL or pass the deployed URL: npm run test:deployment -- https://your-host');
const origin = new URL(base);
async function get(path) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(60000) });
  assert.equal(response.status, 200, `${path} must return HTTP 200`);
  return response;
}

assert.match(await (await get('/')).text(), /Hotel Offer Orchestrator/, 'Landing page must load');
assert.match(await (await get('/site-config.js')).text(), /HOTEL_APP_MODE\s*=\s*["']live["']/, 'Deployment must use live API mode, not preview data');
const health = await (await get('/health')).json();
assert.equal(health.status, 'ok');
assert.deepEqual(health.suppliers, { supplierA: 'up', supplierB: 'up' });
assert.equal(health.redis, 'up');
assert.equal(health.temporal, 'up');
const response = await get('/api/hotels?city=delhi');
assert.ok(response.headers.get('x-request-id'), 'Search must return a workflow correlation ID');
const offers = await response.json();
assert.deepEqual(offers.map(offer => offer.price), [3200, 5340, 5900, 8100]);
assert.equal(new Set(offers.map(offer => offer.name)).size, offers.length);
assert.deepEqual(await (await get('/api/hotels?city=delhi&minPrice=5340&maxPrice=5900')).json(), [
  { name: 'Holtin', price: 5340, supplier: 'Supplier B', commissionPct: 20 },
  { name: 'Radison', price: 5900, supplier: 'Supplier A', commissionPct: 13 },
]);
assert.deepEqual(await (await get('/api/hotels?city=unknown')).json(), []);
const invalid = await fetch(new URL('/api/hotels?city=delhi&minPrice=9&maxPrice=1', origin), { signal: AbortSignal.timeout(10000) });
assert.equal(invalid.status, 400);
console.log(`PASS: ${origin.origin} serves the live frontend, healthy dependencies, correct winners, inclusive filtering, empty results, and validation.`);
