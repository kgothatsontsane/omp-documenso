import config from './rollup.config.mjs';

export default {
  ...config,
  input: 'server/api/cron/index.ts',
  output: {
    ...config.output,
    dir: '../../api/cron-build',
    preserveModules: false,
    entryFileNames: 'index.js',
    chunkFileNames: 'chunks/[name]-[hash].js',
  },
};
