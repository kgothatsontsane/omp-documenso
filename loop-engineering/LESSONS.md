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

## 8. Trigger.dev worker email failures (URL.parse on Node 21)
- Emails stopped going out (recipients stuck `NOT_SENT`, no `EMAIL_SENT` audit log) because the
  Trigger.dev worker runs **Node 21.7.3**, and `URL.parse()` (used in
  `packages/email/utils/branding-url.ts` via the email branding path) requires Node 22.1+.
  Every `send.signing.requested.email` run failed with `URL.parse is not a function`.
- Fix: replace `URL.parse(x)` with `new URL(x)` inside try/catch. Vercel functions run Node 22+
  so the bug only surfaced in the worker.
- Debugging the worker:
  - Runs API: `GET https://api.trigger.dev/api/v1/runs?limit=N` with `Authorization: Bearer <tr_prod_...>` (worker secret key).
  - Error details: `GET /api/v1/runs/{runId}/trace` → walk spans, read `exception` events.
  - Trigger a job manually: `POST /api/v1/tasks/documenso-job/trigger` body `{"payload":{name,payload}, "context":{}}`.
    NOTE: `documentId` must be the NUMERIC id (from `mapSecondaryIdToDocumentId(secondaryId)`), not the `document_4` string.
  - Current deploy: `GET /api/v1/deployments/current` (check `version`, `status`, `runtimeVersion`).
- Worker redeploy: `npx trigger.dev@4.5.12 deploy` (from apps/remix). The depot context upload is
  flaky on this repo (stalls at ~50-90MB); retry until it completes — each retry caches earlier upload chunks.
- Env vars for the worker come from `npx trigger.dev@4.5.12 env` (NOT synced from Vercel).

## 7. Dashboard stats: 7 capped counts per load
- `getStats()` runs 7 capped-count queries (each with EXISTS subqueries against
  Recipient) on every dashboard nav. Added a 60s TTL in-process cache keyed by
  input → 1 DB hit per minute instead of per nav.
- Do not remove the cache; if counts must be fresher, shorten the TTL rather
  than deleting it.

## 9. Signature draw pad: never blit the full canvas per pointermove
- The draw pad lagged because every pointermove did full-canvas `clearRect` +
  `drawImage(committed)` blit + whole-stroke refill at 2x DPI, and every stroke
  end synchronously PNG-encoded (`toDataURL`) + pixel-scanned the canvas.
- Fix pattern (`packages/ui/primitives/signature-pad/signature-pad-draw.tsx`):
  two stacked DOM canvases (committed base + transparent active-stroke overlay),
  rAF-coalesced redraws (1/frame max), `setPointerCapture` so strokes survive
  leaving the pad, rect cached on pointerdown, `push` not spread, and the
  coverage check + `toDataURL` deferred via `setTimeout(0)` off the pointerup path.
- Measured on the deployed pad: 0.089ms/event handler, 0.157ms/frame redraw.
- Known pre-existing quirk (old AND new code): dialog "Sign" stays enabled after
  "Clear Signature" — upstream SignaturePad/localSignature wiring, unchanged here.
- Preview deploys cannot load PDFs (`connect-src 'self'` + localhost URLs) —
  verify pad behaviour via `[data-testid="signature-pad-dialog-button"]`, which
  works without the PDF.

## 10. Dashboard lag was refetch storms, not slow queries
- After two DB-side passes the dashboard still felt slow because React Query's
  stock defaults (`staleTime: 0`, `refetchOnWindowFocus: true`) refetch the
  entire dashboard on every mount and every alt-tab, and every mutation
  invalidated the whole query cache (`packages/trpc/react/index.tsx`).
- Fix: `staleTime: 30_000` + `refetchOnWindowFocus: false` in the QueryClient
  defaults, a small invalidation denylist (inbox badge, quota flags), and a
  30s-throttled focus listener in the LimitsProvider.
- Measure where the lag lives before optimizing queries again: count HTTP
  roundtrips per user action (mount, focus, mutation), not just SQL cost.

## 11. Documents table: fixed layout beats auto layout
- The DataTable sets per-cell widths but the table used auto layout, so content
  (long titles, dates, sender names) forced horizontal scroll and pushed the
  Actions column off-screen. Fix: `table-fixed` + compact column `size`s with
  `truncate` cells; the DataTable now accepts `tableClassName` and applies
  header widths too.

## 12. Duplicate emails: Trigger retries re-run sendMail
- Email jobs send BEFORE writing the EMAIL_SENT audit row. Any failure after
  sendMail (audit write, reminder update, a later recipient) triggers a run
  retry → the same email sends again ("duplicate notification" bug).
- Fix: `hasEmailBeenSent(envelopeId, recipientId, emailType)` guard before
  sendMail (audit-row based) + `sendStatus === SENT` check in the signing
  handler; the cancelled handler now also writes an audit row (it had none).
- Email handlers run in the TRIGGER WORKER — a worker redeploy is required
  for email fixes to take effect (Vercel deploys don't update it).
- Template-use "Create as draft" dead button: (a) putPdfFile fetch had no
  timeout — a stalled upload POST left isSubmitting stuck and the fieldset
  permanently disabled; (b) array-root validation errors had no FormMessage —
  invalid file type/size silently no-opped the submit.

## 13. Static assets through a function = the #1 function-duration cost
- Every /assets /fonts /static /favicon request was routed to api/static.mjs —
  a billed serverless invocation per asset (10-30 per page load). On Pro this
  dominates function-duration billing.
- Fix: build.sh mirrors build/client/{assets,fonts,static,bimi} + root
  favicons/webmanifest/robots to the deployment root; vercel.json routes are
  now just `handle: filesystem` + the /api catch-all, so the CDN/edge serves
  assets (verified via x-vercel-cache: HIT, age headers) with zero invocations.
- api/static.mjs is kept as an unbundled fallback; if asset routes ever break,
  suspect this change first and check `handle: filesystem` ordering.
- Next duration lever if still high: /api/files PDF streaming (documents are
  base64 in Postgres — MBs per view through the function). Fix = object
  storage (R2/S3) migration.
