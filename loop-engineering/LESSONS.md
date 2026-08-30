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
