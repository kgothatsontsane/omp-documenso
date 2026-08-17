import { esbuildPlugin } from '@trigger.dev/build/extensions';
import { syncVercelEnvVars } from '@trigger.dev/build/extensions/core';
import { defineConfig } from '@trigger.dev/sdk';
import type { Plugin } from 'esbuild';

const poStubPlugin: Plugin = {
  name: 'po-stub',
  setup(build) {
    build.onLoad({ filter: /\.po$/ }, () => ({
      contents: 'export const messages = {};',
      loader: 'js',
    }));
  },
};

export default defineConfig({
  project: 'proj_pgxztmkkgkbkaptgxtvk',
  runtime: 'node',
  logLevel: 'log',
  // Sweeps touch Prisma, PDF rendering and email; allow up to 15 minutes.
  maxDuration: 900,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ['./trigger'],
  build: {
    // The cron handlers pull in the whole app graph. Native modules and
    // chromium-bidi cannot be bundled; keep them external so they load from
    // node_modules at runtime (same strategy as rollup.cron.config.mjs).
    external: [
      // Native modules
      'skia-canvas',
      '@napi-rs/canvas',
      '@node-rs/bcrypt',
      'sharp',
      '@resvg/resvg-js',
      'playwright',
      'playwright-core',
      '@playwright/browser-chromium',
      'chromium-bidi',
      'pdfjs-dist',
      // Prisma engine ships platform binaries; resolve at runtime. Client JS is
      // bundled by esbuild (CJS->ESM interop), so do NOT externalize it.
      '@prisma/engines',
    ],
    extensions: [
      syncVercelEnvVars({
        projectId: 'prj_JHJK5nzAnH5kBO1Iyz0JCjo4Ajwy',
        vercelTeamId: 'team_mLc5syhhwDuEIz6BLsD2WqVc',
      }),
      // i18n-server dynamic-imports web.po in dev and web.mjs in prod; esbuild
      // tries to resolve the .po sibling. In prod the compiled .mjs is used, so
      // stub .po as an empty module.
      esbuildPlugin(poStubPlugin),
    ],
  },
});
