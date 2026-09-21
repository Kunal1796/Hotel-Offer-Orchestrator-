import { ApplicationFailure, log } from '@temporalio/activity';
import { config } from './config';
import { supplierHotelsSchema } from './validation';
import { saveAndFilter, type RedisConnection } from './redis';
import type { HotelQuery, Offer, Supplier, SupplierHotel } from './types';

export async function fetchSupplier(supplier: Supplier, city: string): Promise<SupplierHotel[]> {
  const path = supplier === 'Supplier A' ? '/supplierA/hotels' : '/supplierB/hotels';
  const url = new URL(path, config.SUPPLIER_BASE_URL);
  url.searchParams.set('city', city);
  log.info('Fetching supplier offers', { supplier, city });
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) {
      throw ApplicationFailure.create({
        message: `${supplier} returned HTTP ${response.status}`,
        type: 'SupplierHttpError',
        nonRetryable: response.status >= 400 && response.status < 500 && response.status !== 429,
      });
    }
    const parsed = supplierHotelsSchema.safeParse(await response.json());
    if (!parsed.success) throw ApplicationFailure.nonRetryable('Invalid supplier response', 'SupplierDataError');
    return parsed.data.filter(hotel => hotel.city.trim().toLowerCase() === city);
  } catch (error) {
    log.error('Supplier request failed', { supplier, city, error: String(error) });
    throw error;
  }
}

export function createActivities(redis: RedisConnection) {
  return {
    fetchSupplier,
    async persistAndFilter(snapshotId: string, offers: Offer[], query: HotelQuery): Promise<Offer[]> {
      log.info('Saving offers and filtering in Redis', { city: query.city, count: offers.length });
      return saveAndFilter(redis, snapshotId, offers, query, config.SNAPSHOT_TTL_SECONDS);
    },
  };
}
export type Activities = ReturnType<typeof createActivities>;
