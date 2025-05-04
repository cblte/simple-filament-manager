import { Hono } from 'hono';
import { logger } from 'hono/logger';

const app = new Hono();

// Middleware hinzufügen
app.use('*', logger());

app.get('/', (c) => {
  return c.text('Hello Hono!');
});

export default app;
