import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supplierA, supplierB } from '../src/suppliers';

const activities = vi.hoisted(() => ({ fetchSupplier: vi.fn(), persistAndFilter: vi.fn() }));
vi.mock('@temporalio/workflow', () => ({
  proxyActivities: () => activities,
  workflowInfo: () => ({ workflowId: 'test-workflow' }),
  log: { info: vi.fn(), error: vi.fn() },
}));
import { hotelOffersWorkflow } from '../src/workflows';

describe('workflow orchestration', () => {
  beforeEach(() => vi.resetAllMocks());
  it('starts both suppliers before awaiting either and persists winners with the bounds', async () => {
    let resolveA!: (hotels: typeof supplierA) => void;
    activities.fetchSupplier.mockImplementation((supplier: string) => supplier === 'Supplier A'
      ? new Promise(resolve => { resolveA = resolve; }) : Promise.resolve(supplierB));
    activities.persistAndFilter.mockResolvedValue([{ name: 'filtered-by-redis' }]);
    const query = { city: 'delhi', minPrice: 5340, maxPrice: 5900 };
    const pending = hotelOffersWorkflow(query);
    expect(activities.fetchSupplier.mock.calls).toEqual([['Supplier A', 'delhi'], ['Supplier B', 'delhi']]);
    expect(activities.persistAndFilter).not.toHaveBeenCalled();
    resolveA(supplierA);
    expect(await pending).toEqual([{ name: 'filtered-by-redis' }]);
    const [id, offers, bounds] = activities.persistAndFilter.mock.calls[0];
    expect(id).toBe('test-workflow');
    expect(offers.find((o: { name: string }) => o.name === 'Holtin').price).toBe(5340);
    expect(bounds).toEqual(query);
  });
  it('fails without writing a misleading partial snapshot if a supplier fails', async () => {
    activities.fetchSupplier.mockRejectedValue(new Error('Supplier down'));
    await expect(hotelOffersWorkflow({ city: 'delhi' })).rejects.toThrow('Supplier down');
    expect(activities.persistAndFilter).not.toHaveBeenCalled();
  });
});
