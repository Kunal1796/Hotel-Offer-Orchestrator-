import { NativeConnection, Worker } from '@temporalio/worker';
import { config } from './config';
import { createActivities } from './activities';
import { makeRedis } from './redis';
import { logger } from './logger';

async function main() {
  const redis = makeRedis(config.REDIS_URL);
  redis.on('error', err => logger.error({ err }, 'Worker Redis error'));
  await redis.connect();
  const connection = await NativeConnection.connect({ address: config.TEMPORAL_ADDRESS });
  try {
    const worker = await Worker.create({
      connection, namespace: config.TEMPORAL_NAMESPACE,
      taskQueue: config.TEMPORAL_TASK_QUEUE,
      workflowsPath: require.resolve('./workflows'),
      activities: createActivities(redis),
    });
    await worker.run();
  } finally {
    await connection.close();
    await redis.quit();
  }
}

main().catch(err => { logger.fatal({ err }, 'Worker failed'); process.exit(1); });
