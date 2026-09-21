import { describe, expect, it } from 'vitest';
import { bestOffers } from '../src/compare';
import { supplierA, supplierB } from '../src/suppliers';

describe('best offers', () => {
  it('selects the cheaper overlapping offers and retains unique hotels', () => {
    const offers = bestOffers(supplierA.filter(h => h.city === 'delhi'), supplierB.filter(h => h.city === 'delhi'));
    expect(offers).toHaveLength(4);
    expect(offers).toContainEqual({ name: 'Holtin', price: 5340, supplier: 'Supplier B', commissionPct: 20 });
    expect(offers).toContainEqual({ name: 'Radison', price: 5900, supplier: 'Supplier A', commissionPct: 13 });
    expect(offers.map(o => o.name)).toEqual(expect.arrayContaining(['City Inn', 'Grand Palace']));
    expect(offers[0]).not.toHaveProperty('hotelId');
  });
  it('normalizes names, deduplicates within a supplier, and prefers A on ties', () => {
    const first = supplierA[0];
    expect(bestOffers([first, { ...first, name: ' HOLTIN ', price: 100 }], [{ ...first, price: 100 }]))
      .toEqual([{ name: 'HOLTIN', price: 100, supplier: 'Supplier A', commissionPct: 10 }]);
  });
  it('handles no offers and free hotels', () => {
    expect(bestOffers([], [])).toEqual([]);
    expect(bestOffers([supplierA[0]], [{ ...supplierB[0], price: 0 }])[0].price).toBe(0);
  });
});
