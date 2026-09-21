import type { Offer, SupplierHotel } from './types';

// Stable input order makes Supplier A the winner for equal prices.
export function bestOffers(a: SupplierHotel[], b: SupplierHotel[]): Offer[] {
  const byName = new Map<string, Offer>();
  for (const [hotels, supplier] of [[a, 'Supplier A'], [b, 'Supplier B']] as const) {
    for (const hotel of hotels) {
      const key = hotel.name.trim().toLowerCase();
      const existing = byName.get(key);
      if (!existing || hotel.price < existing.price) {
        byName.set(key, { name: hotel.name.trim(), price: hotel.price, supplier, commissionPct: hotel.commissionPct });
      }
    }
  }
  return [...byName.values()];
}
