import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  TEMPORAL_ADDRESS: z.string().default('localhost:7233'),
  TEMPORAL_NAMESPACE: z.string().default('default'),
  TEMPORAL_TASK_QUEUE: z.string().default('hotel-offers'),
  SUPPLIER_BASE_URL: z.string().url().default('http://localhost:3000'),
  SUPPLIER_A_DOWN: z.enum(['true', 'false']).default('false'),
  SUPPLIER_B_DOWN: z.enum(['true', 'false']).default('false'),
  SNAPSHOT_TTL_SECONDS: z.coerce.number().int().min(60).default(300),
});

export const config = schema.parse(process.env);
