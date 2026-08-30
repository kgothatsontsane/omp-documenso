# Loop Engineering — Durable Lessons (OMP Documenso)

## 1. Vercel "Sensitive" env vars are write-only (root cause of Trigger poisoning)
- Vercel's API refuses to return Sensitive-flagged vars even with `decrypt=true`;
  `vercel env pull` redacts them. Any sync that copies them into another system
  (e.g. Trigger.dev `syncVercelEnvVars`) writes placeholder text (`[SENSITIVE]`,
  or empty → bad defaults like SMTP `127.0.0.1:2500`).
- Fix pattern: ask the owner for the real value and push it directly to the
  target system's env. Do NOT rely on automated sync for Sensitive vars.
- If sync must run: in Vercel dashboard, toggle OFF "Sensitive" on the var, then
  redeploy so the real value propagates.

## 2. i18n translation catalogs in Vercel builds-mode
- The app server (`api/index.mjs` → rollup `build/server`) imports catalogs from
  `packages/lib/translations/<lang>/web.mjs` via a template-literal dynamic
  import (`import(\`../../translations/${lang}/web.mjs\`)`). nft cannot trace a
  computed path, so the files are NOT bundled → runtime MODULE_NOT_FOUND → UI
  silently falls back to English.
- Bare side-effect imports (`import '.../web.mjs'`) are TREE-SHAKEN by rollup
  (unused) → also not bundled.
- Working fix: `import * as xCatalog from '.../web.mjs'` and hold each in a
  *referenced* static map so rollup keeps it in the graph; nft then traces it.
- TS: ambient `declare module '*.mjs'` in `packages/lib/types/modules.d.ts` is
  NOT in the remix tsc include graph → use `// @ts-ignore` on each import line.
- The fallback (`catch` → empty messages → source strings) is what kept the site
  from 500ing; it is a safety net, not a substitute for bundling.

## 3. Trigger.dev job provider (not Vercel serverless functions)
- Background jobs run on Trigger.dev (`NEXT_PRIVATE_JOBS_PROVIDER=trigger`), not
  Vercel functions. A single generic `documenso-job` task dispatches by
  definition name (`internal.seal-document`, etc.).
- Trigger deploy: `npx trigger.dev@4.5.12 deploy` (no `--prod` flag — it
  deploys to prod by default). Needs `TRIGGER_SECRET_KEY` in env.
- Vercel deploy: `npx vercel deploy --prod` (session auth works; do NOT use
  `--prebuilt` after source changes — it ships stale cached build).

## 4. Certificate of completion = branding, not the crypto signer
- "Signing certificate provided by: [logo]" is a white-label branding element
  (reads `public/static/logo.png`). The legal signer is Trusted Signatures'
  HSM cert embedded in the PDF's CMS signature. Do not swap the logo to Trusted
  Signatures — that would be misleading.
- The QR code on the cert = `${NEXT_PUBLIC_WEBAPP_URL}/share/${qrToken}` (public
  share link), not a signature-verification token.

## 5. Vercel `functions` vs `builds` are mutually exclusive (root cause of the 2026-08-30 outage)
- `vercel.json` CANNOT have both a top-level `functions` map AND a `builds`
  array — Vercel rejects it with `bad_request` ("The functions property cannot
  be used in conjunction with the builds property").
- The working production config uses ONLY `functions`:
  - `api/index.mjs` → `includeFiles: "api/build/server/**"`
  - `api/static.mjs` → `includeFiles: "api/build/client/**"`
  - routes: `/assets`, `/fonts`, `/static`, favicons, `/bimi` → `/api/static`;
    filesystem; catch-all → `/api`
- `apps/remix/.bin/build.sh` MUST end by copying the build to `api/build`
  (`rm -rf ../../api/build && cp -R build ../../api/build && cp package.json
  ../../api/build/package.json`). If that copy is missing, git-based deploys
  crash at runtime with `FUNCTION_INVOCATION_FAILED` /
  `Cannot find module '/var/task/api/build/server/hono/server/router.js'`.
  The `includeFiles` globs are what force nft to bundle the gitignored
  `api/build/**` into the lambda.
- `api/static.mjs` must exist (it serves all static assets from
  `api/build/client`). Do not delete it.

## 6. Production-first workflow (staging branch)
- NEVER push directly to `main` — every `main` push auto-deploys production.
- Flow: work on `staging` → push → wait for the Vercel PREVIEW deploy →
  verify the preview URL with the protection-bypass header
  (`x-vercel-protection-bypass: $VERCEL_BYPASS_TOKEN`, from Project →
  Settings → Deployment Protection — NEVER commit it) returns
  HTTP 200 and no `FUNCTION_INVOCATION_FAILED` → only then
  `git merge --ff-only staging` onto `main` and push.
- Rollback: `npx vercel promote https://<last-good-deploy-url>` instantly
  repoints production.
- Preview deploy URLs are Vercel-SSO protected; the bypass token above is the
  only way to curl them.

## 7. Dashboard stats: 7 capped counts per load
- `getStats()` runs 7 capped-count queries (each with EXISTS subqueries against
  Recipient) on every dashboard nav. Added a 60s TTL in-process cache keyed by
  input → 1 DB hit per minute instead of per nav.
- Do not remove the cache; if counts must be fresher, shorten the TTL rather
  than deleting it.
