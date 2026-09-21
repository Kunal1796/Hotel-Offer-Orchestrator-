import { randomUUID } from 'node:crypto';
import path from 'node:path';
import express from 'express';
import { hotelQuerySchema } from './validation';
import { supplierA, supplierB } from './suppliers';
import { logger } from './logger';
import type { HotelQuery, Offer } from './types';

export interface AppDependencies {
  search(query: HotelQuery, requestId: string): Promise<Offer[]>;
  health(): Promise<{ status: string; redis: string; temporal: string; suppliers: { supplierA: string; supplierB: string } }>;
  supplierADown: boolean;
  supplierBDown: boolean;
}

export function createApp(deps: AppDependencies) {
  const app = express();
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  app.get('/site-config.js', (_req, res) => {
    res.type('application/javascript').set('Cache-Control', 'no-store').send('window.HOTEL_APP_MODE = "live";');
  });
  app.use(express.static(path.resolve(__dirname, '../public')));
  app.get('/api/hotels', async (req, res) => {
    const requestId = randomUUID();
    res.setHeader('X-Request-Id', requestId);
    const parsed = hotelQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query', details: parsed.error.issues, requestId });
      return;
    }
    try {
      res.json(await deps.search(parsed.data, requestId));
    } catch (error) {
      logger.error({ err: error, requestId }, 'Hotel search failed');
      res.status(503).json({ error: 'Hotel search unavailable. Please retry later.', requestId });
    }
  });

  for (const [path, hotels, down] of [
    ['/supplierA/hotels', supplierA, deps.supplierADown],
    ['/supplierB/hotels', supplierB, deps.supplierBDown],
  ] as const) {
    app.get(path, (req, res) => {
      if (down) { res.status(503).json({ error: 'Supplier temporarily unavailable' }); return; }
      if (req.query.city === undefined) { res.json(hotels); return; }
      const parsed = hotelQuerySchema.safeParse(req.query);
      if (!parsed.success) { res.status(400).json({ error: 'Invalid city' }); return; }
      res.json(hotels.filter(h => h.city === parsed.data.city));
    });
  }

  app.get('/health', async (_req, res) => {
    try {
      const health = await deps.health();
      res.status(health.status === 'ok' ? 200 : 503).json(health);
    } catch (error) {
      logger.error({ err: error }, 'Health check failed');
      res.status(503).json({ status: 'unhealthy' });
    }
  });
  app.use((_req, res) => { res.status(404).json({ error: 'Not found' }); });
  return app;
}
