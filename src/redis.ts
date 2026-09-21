import { createClient } from 'redis';
import type { HotelQuery, Offer } from './types';

export function makeRedis(url: string) {
  return createClient({ url, disableOfflineQueue: true, socket: {
    connectTimeout: 3000,
    reconnectStrategy: retries => retries < 5 ? Math.min(200 * 2 ** retries, 3000) : false,
  } });
}
export type RedisConnection = ReturnType<typeof makeRedis>;

// One atomic operation writes the entire snapshot and applies inclusive filtering.
// Each workflow owns its key, so concurrent searches cannot overwrite each other.
const saveAndFilterScript = `
redis.call('DEL', KEYS[1])
local offers = cjson.decode(ARGV[1])
for _, offer in ipairs(offers) do
  redis.call('ZADD', KEYS[1], offer.price, cjson.encode(offer))
end
redis.call('EXPIRE', KEYS[1], ARGV[2])
return redis.call('ZRANGE', KEYS[1], ARGV[3], ARGV[4], 'BYSCORE')
`;

export async function saveAndFilter(
  redis: RedisConnection, snapshotId: string, offers: Offer[], query: HotelQuery, ttl: number,
): Promise<Offer[]> {
  const key = `hotels:${encodeURIComponent(query.city)}:${snapshotId}`;
  const rows = await redis.eval(saveAndFilterScript, {
    keys: [key],
    arguments: [JSON.stringify(offers), String(ttl), String(query.minPrice ?? '-inf'), String(query.maxPrice ?? '+inf')],
  }) as string[];
  return rows.map(row => JSON.parse(row) as Offer);
}
