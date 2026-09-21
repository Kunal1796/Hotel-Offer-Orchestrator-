import express from 'express';
import path from 'node:path';

// Frontend-only preview; live requests are served by server.ts with Temporal and Redis.
const app = express();
app.use(express.static(path.resolve(__dirname, '../public')));
app.listen(3000, '127.0.0.1', () => {
  console.log('Landing-page preview: http://localhost:3000 (sample data only)');
});
