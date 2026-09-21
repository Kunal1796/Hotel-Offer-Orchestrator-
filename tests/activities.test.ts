import { afterEach, describe, expect, it, vi } from 'vitest';
import { MockActivityEnvironment } from '@temporalio/testing';
import { fetchSupplier } from '../src/activities';
import { supplierA } from '../src/suppliers';

afterEach(() => vi.unstubAllGlobals());
describe('supplier activity', () => {
  it('calls the city-specific URL and excludes other cities', async () => {
    const stub = vi.fn().mockResolvedValue(new Response(JSON.stringify(supplierA)));
    vi.stubGlobal('fetch', stub);
    const result = await new MockActivityEnvironment().run(fetchSupplier, 'Supplier A', 'delhi');
    expect(result).toHaveLength(3);
    expect(String(stub.mock.calls[0][0])).toBe('http://localhost:3000/supplierA/hotels?city=delhi');
  });
  it('rejects malformed supplier prices without retrying', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([{ ...supplierA[0], price: -10 }]))));
    await expect(new MockActivityEnvironment().run(fetchSupplier, 'Supplier A', 'delhi'))
      .rejects.toMatchObject({ type: 'SupplierDataError', nonRetryable: true });
  });
  it('marks a supplier outage as retryable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    await expect(new MockActivityEnvironment().run(fetchSupplier, 'Supplier B', 'delhi'))
      .rejects.toMatchObject({ type: 'SupplierHttpError', nonRetryable: false });
  });
});
