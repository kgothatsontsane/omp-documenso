# Loop: Email white-label (Documenso → Open Mic Productions)

## Objective
White-label every email template + logo to "Open Mic Productions". Code-default
path (covers ALL emails including no-org ones: 2FA, reset password, confirm email).

## Target brand
- Name: Open Mic Productions
- Logo file: apps/remix/public/static/omp_logo_b.png (1032×360)
- Email logo target: packages/email/static/logo.png (resized)
- Demo URLs: https://agreements.open-mic.co.za
- Support email: support@open-mic.co.za
- Footer company: "Open Mic Productions" (no street address known)

## Inventory (discovered)
| File | Change |
|------|--------|
| packages/email/static/logo.png | Replace content with OMP logo (resized) |
| template-components/template-branding-logo.tsx | alt text "Open Mic Productions Logo" |
| template-components/template-footer.tsx | "sent using Open Mic Productions" link + company details |
| constants/email.ts | FROM_NAME/FROM_ADDRESS defaults → OMP |
| constants/app.ts | SUPPORT_EMAIL default → OMP |
| 17 template .tsx files | Documenso text → Open Mic Productions; documenso.com → agreements.open-mic.co.za; @documenso.com → @open-mic.co.za |

## Verification
- packages/email + packages/lib typecheck (tsc --noEmit)
- Render one template via preview package to confirm OMP logo + footer
- Vercel deploy

## Notes
- SMTP_FROM_ADDRESS/NAME already set on Vercel (user confirmed emails arriving).
- No OrganisationGlobalSettings rows for OMP org yet → DB branding config optional, skip (code defaults suffice).
- Keep demo prop defaults (inviterEmail etc.) neutral → open-mic.co.za.
## Verification (completed)
- packages/email tsc: clean. packages/lib tsc: clean (3 pre-existing files only).
- Render check via REAL production pipeline (`renderEmailWithI18N` + preview server `/api/render` on `document-invite`): PASS — 0 "Documenso", 0 "documenso.com", alt="Open Mic Productions Logo", static/logo.png = OMP logo (HTTP 200 image/png), footer "sent using Open Mic Productions".
- Biome: only pre-existing warnings (noExplicitAny/useAwait/unused demo props) — none introduced.
- No OrganisationGlobalSettings rows in DB → code defaults are the single white-label source.

## Deployed?
- Vercel deploy in progress → log /tmp/vercel-deploy-whitelabel.log
