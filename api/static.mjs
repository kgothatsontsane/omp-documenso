import path from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';

const app = new Hono();

app.use('*', async (c, next) => {
  // Content-hashed build assets are immutable and can be cached forever.
  if (c.req.path.startsWith('/assets/')) {
    c.header('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (c.req.path.startsWith('/fonts/') || c.req.path.startsWith('/static/')) {
    // Static fonts and images change only on redeploy; allow long-lived caching
    // while keeping revalidation so a fresh deploy is picked up quickly.
    c.header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=2592000');
  }

  await next();
});

app.use(
  '*',
  serveStatic({
    root: path.join(process.cwd(), 'api/build/client'),
  }),
);

export default async function handler(req, res) {
  const host = req.headers.host ?? 'localhost';
  const request = new Request(`https://${host}${req.url}`, {
    method: req.method,
    headers: req.headers,
  });
  const response = await app.fetch(request);

  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}
