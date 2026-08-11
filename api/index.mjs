import path from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import handle from 'hono-react-router-adapter/node';

const { default: server, getLoadContext } = await import('./build/server/hono/server/router.js');
const build = await import('./build/server/index.js');

server.use(
  serveStatic({
    root: path.join(process.cwd(), 'apps/remix/public'),
  }),
);

export default handle(build, server, { getLoadContext });
