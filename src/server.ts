import { Client, Connection } from '@temporalio/client';
import { config } from './config';
import { createApp } from './app';
import { makeRedis } from './redis';
import { logger } from './logger';
import type { hotelOffersWorkflow } from './workflows';

async function main() {
  const redis = makeRedis(config.REDIS_URL);
  redis.on('error', err => logger.error({ err }, 'Redis connection error'));
  await redis.connect();
  const connection = await Connection.connect({ address: config.TEMPORAL_ADDRESS });
  const client = new Client({ connection, namespace: config.TEMPORAL_NAMESPACE });
  const probe = async (path: string) => {
    const response = await fetch(new URL(path, config.SUPPLIER_BASE_URL), { signal: AbortSignal.timeout(2000) });
    if (!response.ok) throw new Error(`Supplier HTTP ${response.status}`);
  };
  const app = createApp({
    supplierADown: config.SUPPLIER_A_DOWN === 'true',
    supplierBDown: config.SUPPLIER_B_DOWN === 'true',
    search: (query, requestId) => client.workflow.execute<typeof hotelOffersWorkflow>('hotelOffersWorkflow', {
      args: [query], taskQueue: config.TEMPORAL_TASK_QUEUE,
      workflowId: `hotel-search-${requestId}`, workflowExecutionTimeout: '45 seconds',
    }),
    async health() {
      const outcomes = await Promise.allSettled([
        redis.ping(),
        connection.withDeadline(Date.now() + 2000, () => connection.workflowService.getSystemInfo({})),
        probe('/supplierA/hotels'), probe('/supplierB/hotels'),
      ]);
      const state = (index: number) => outcomes[index].status === 'fulfilled' ? 'up' : 'down';
      return {
        status: outcomes.every(o => o.status === 'fulfilled') ? 'ok' : 'degraded',
        redis: state(0), temporal: state(1), suppliers: { supplierA: state(2), supplierB: state(3) },
      };
    },
  });
  const server = app.listen(config.PORT, '0.0.0.0', () => logger.info({ port: config.PORT }, 'API listening'));
  const shutdown = () => {
    server.close(() => { void Promise.allSettled([redis.quit(), connection.close()]).then(() => process.exit(0)); });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch(err => { logger.fatal({ err }, 'API startup failed'); process.exit(1); });
