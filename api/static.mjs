import path from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';

const app = new Hono();

app.use(
  '*',
  serveStatic({
    root: path.join(process.cwd(), 'api/build/client'),
    rewriteRequestPath: (requestPath) => requestPath.replace(/^\/api\/static/, ''),
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
