import { Hono } from 'hono';

const { cronHandler } = await import('./cron-build/index.mjs');
const app = new Hono();

app.get('/api/cron/sweeps', cronHandler);

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
