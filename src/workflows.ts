import { log, proxyActivities, workflowInfo } from '@temporalio/workflow';
import type { Activities } from './activities';
import { bestOffers } from './compare';
import type { HotelQuery, Offer } from './types';

const { fetchSupplier, persistAndFilter } = proxyActivities<Activities>({
  startToCloseTimeout: '8 seconds',
  scheduleToCloseTimeout: '30 seconds',
  retry: { initialInterval: '1 second', backoffCoefficient: 2, maximumAttempts: 3 },
});

export async function hotelOffersWorkflow(query: HotelQuery): Promise<Offer[]> {
  log.info('Hotel search started', { city: query.city });
  try {
    const [a, b] = await Promise.all([
      fetchSupplier('Supplier A', query.city),
      fetchSupplier('Supplier B', query.city),
    ]);
    const offers = bestOffers(a, b);
    return await persistAndFilter(workflowInfo().workflowId, offers, query);
  } catch (error) {
    log.error('Hotel search failed', { city: query.city, error: String(error) });
    throw error;
  }
}
