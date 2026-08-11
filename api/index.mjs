import handle from 'hono-react-router-adapter/node';

const { default: server, getLoadContext } = await import('./build/server/hono/server/router.js');
const build = await import('./build/server/index.js');

export default handle(build, server, { getLoadContext });
