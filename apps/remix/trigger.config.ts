import path from 'node:path';
import { esbuildPlugin } from '@trigger.dev/build/extensions';
import { aptGet, syncVercelEnvVars } from '@trigger.dev/build/extensions/core';
import { prismaExtension } from '@trigger.dev/build/extensions/prisma';
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

// The Lingui macros (`msg`, `t`, `Trans`, `Plural`) are Babel compile-time
// transforms. The trigger.dev esbuild build cannot run that plugin, so redirect
// the macro entry points to a runtime shim. English-only emails make literal
// resolution correct.
const linguiMacroStubPath = path.resolve(__dirname, './trigger/lingui-macro-stub.ts');

const linguiMacroStubPlugin: Plugin = {
  name: 'lingui-macro-stub',
  setup(build) {
    build.onResolve({ filter: /^@lingui\/(core|react)\/macro$/ }, () => ({
      path: linguiMacroStubPath,
    }));
    build.onResolve({ filter: /^@lingui\/macro$/ }, () => ({
      path: linguiMacroStubPath,
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
      // LibreOffice is needed by the docx-to-pdf conversion task.
      aptGet({
        packages: ['libreoffice'],
      }),
      syncVercelEnvVars({
        projectId: 'prj_JHJK5nzAnH5kBO1Iyz0JCjo4Ajwy',
        vercelTeamId: 'team_mLc5syhhwDuEIz6BLsD2WqVc',
      }),
      // Regenerate the Prisma client for the trigger.dev Linux runtime and
      // install the matching query engine. Without this, the bundled client
      // (generated for darwin locally) cannot locate the debian engine.
      prismaExtension({
        mode: 'legacy',
        schema: '../../packages/prisma/schema.prisma',
        directUrlEnvVarName: 'NEXT_PRIVATE_DIRECT_DATABASE_URL',
        // Only regenerate the Prisma client. The schema also has kysely/json/zod
        // generators whose binaries aren't in the trigger.dev build image.
        clientGenerator: 'client',
      }),
      // i18n-server dynamic-imports web.po in dev and web.mjs in prod; esbuild
      // tries to resolve the .po sibling. In prod the compiled .mjs is used, so
      // stub .po as an empty module.
      esbuildPlugin(poStubPlugin),
      esbuildPlugin(linguiMacroStubPlugin),
    ],
  },
});
