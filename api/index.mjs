import { readFile } from 'node:fs/promises';
import handle from 'hono-react-router-adapter/node';

const { default: server, getLoadContext } = await import('../apps/remix/build/server/hono/server/router.js');
const build = await import('../apps/remix/build/server/index.js');
const logo = await readFile(new URL('./omp_logo_b.png', import.meta.url));

server.get('/static/omp_logo_b.png', (c) =>
  c.body(logo, 200, { 'Cache-Control': 'public, max-age=86400', 'Content-Type': 'image/png' }),
);

export default handle(build, server, { getLoadContext });
