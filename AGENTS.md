# Agent Guidelines for Documenso

## PRODUCTION STABILITY (MANDATORY)

**Production = `main` branch → auto-deploys to `https://agreements.open-mic.co.za`.**

**NEVER push directly to `main`.** Always use the staging-first workflow:

1. Create a `staging` branch from `main`: `git checkout -b staging main`
2. Make changes, commit, push to `staging`: `git push origin staging`
3. Wait for the Vercel **preview** deployment to reach READY (~10 min; `npx vercel ls`)
4. Verify the preview at runtime BEFORE any production deploy:
   ```bash
   # get preview URL from `npx vercel ls` (newest deployment)
   # `$VERCEL_BYPASS_TOKEN` = your Vercel "Protection Bypass for Automation"
   # token (Project → Settings → Deployment Protection). NEVER commit it.
   URL="https://<preview-uid>-open-mic-productions.vercel.app"
   curl -s -o /dev/null -w "%{http_code}\n" -H "x-vercel-protection-bypass: $VERCEL_BYPASS_TOKEN" "$URL/signin"
   curl -s -H "x-vercel-protection-bypass: $VERCEL_BYPASS_TOKEN" "$URL/signin" | grep -c "FUNCTION_INVOCATION_FAILED"
   ```
   Expected: `200` and no `FUNCTION_INVOCATION_FAILED`.
5. Only if the preview is HTTP 200 with real content, merge to `main`:
   ```bash
   git checkout main && git merge --ff-only staging && git push origin main
   ```
6. Watch the production deploy reach READY, then verify `https://agreements.open-mic.co.za/signin` returns 200.

**CRITICAL deployment constraints (do not change without re-verifying):**

- `vercel.json` uses the **`functions`** key (NOT `builds`). `functions` and `builds` are mutually exclusive — combining them is a hard error.
  - `api/index.mjs`: `includeFiles: "api/build/server/**"`
  - `api/static.mjs`: `includeFiles: "api/build/client/**"`
- `apps/remix/.bin/build.sh` MUST end by copying the build output to `api/build` (`rm -rf ../../api/build && cp -R build ../../api/build && cp package.json ../../api/build/package.json`). If that copy is removed, git-based deploys fail at runtime with `FUNCTION_INVOCATION_FAILED: Cannot find module '/var/task/api/build/server/hono/server/router.js'`.
- `api/static.mjs` serves static assets (CSS, fonts, favicons) from `api/build/client` and MUST exist — do not delete it.
- The `functions.includeFiles` globs are what make git-based deploys bundle the server code. Do not remove them.
- `syncVercelEnvVars` is DISABLED in `apps/remix/trigger.config.ts` (Vercel sensitive env vars are write-only; syncing poisons Trigger). Do not re-enable.
- `.env.vercel` and `.env.preview.local` contain live secrets and are gitignored — never commit them.

**Rollback:** if production breaks, `npx vercel promote https://<last-good-deploy-url>` instantly repoints production.

## Build/Test/Lint Commands

- `npm run build` - Build all packages
- `npm run lint` - Lint all packages
- `npm run lint:fix` - Auto-fix linting issues
- `npm run test:e2e` - Run E2E tests with Playwright
- `npm run test:dev -w @documenso/app-tests` - Run single E2E test in dev mode
- `npm run test-ui:dev -w @documenso/app-tests` - Run E2E tests with UI
- `npm run format` - Format code with Biome
- `npm run dev` - Start development server for Remix app

**Important:** Do not run `npm run build` to verify changes unless explicitly asked. Builds take a long time (~2 minutes). Use `npx tsc --noEmit` for type checking specific packages if needed.

## Code Style Guidelines

- Use TypeScript for all code; prefer `type` over `interface`
- Use functional components with `const Component = () => {}`
- Never use classes; prefer functional/declarative patterns
- Use descriptive variable names with auxiliary verbs (isLoading, hasError)
- Directory names: lowercase with dashes (auth-wizard)
- Use named exports for components
- Never use 'use client' directive
- Never use 1-line if statements
- Structure files: exported component, subcomponents, helpers, static content, types

## Error Handling & Validation

- Use custom AppError class when throwing errors
- When catching errors on the frontend use `const error = AppError.parse(error)` to get the error code
- Use early returns and guard clauses
- Use Zod for form validation and react-hook-form for forms
- Use error boundaries for unexpected errors

## UI & Styling

- Use Shadcn UI, Radix, and Tailwind CSS with mobile-first approach
- Use `<Form>` `<FormItem>` elements with fieldset having `:disabled` attribute when loading
- Use Lucide icons with longhand names (HomeIcon vs Home)

## TRPC Routes

- Each route in own file: `routers/teams/create-team.ts`
- Associated types file: `routers/teams/create-team.types.ts`
- Request/response schemas: `Z[RouteName]RequestSchema`, `Z[RouteName]ResponseSchema`
- Only use GET and POST methods in OpenAPI meta
- Deconstruct input argument on its own line
- Prefer route names such as get/getMany/find/create/update/delete
- "create" routes request schema should have the ID and data in the top level
- "update" routes request schema should have the ID in the top level and the data in a nested "data" object

## Translations & Remix

- Use `<Trans>string</Trans>` for JSX translations from `@lingui/react/macro`
- Use `t\`string\`` macro for TypeScript translations
- Use `(params: Route.Params)` and `(loaderData: Route.LoaderData)` for routes
- Directly return data from loaders, don't use `json()`
- Use `superLoaderJson` when sending complex data through loaders such as dates or prisma decimals
