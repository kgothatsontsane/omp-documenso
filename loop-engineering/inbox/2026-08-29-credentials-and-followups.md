# Inbox — needs a human decision or credential

## 1. TrustedSignatures production key (owner: Kgothatso)
The owner will provide the production key ONLY after end-to-end signing +
sealing is verified. Everything else must be green first. When provided:
- `NEXT_PRIVATE_SIGNING_*` values live on Vercel (production) and Trigger.
- Verify by completing a real envelope end-to-end.

## 2. Vercel Sensitive env vars are write-only (root cause, action: owner)
23 production vars on Vercel are flagged "Sensitive" — Vercel's API refuses to
return their values (even decrypt=true), and `vercel env pull` redacts them.
This is why the Trigger env sync wrote placeholder garbage (e.g. SMTP host
defaulting to 127.0.0.1:2500, transport `[SENSITIVE]`).
Two options when the owner is back:
- Preferred: paste the 4 email values directly (already done for Resend), OR
- In Vercel dashboard → Settings → Environment Variables: edit each var and
  toggle OFF "Sensitive" (then re-run `npx trigger.dev@4.5.12 deploy` with
  VERCEL_ACCESS_TOKEN set so the sync copies real values).
Vars that matter for the worker: SMTP/RESEND (done via manual import), upload
R2 creds (done via manual import), encryption keys, NEXTAUTH_SECRET.

## 3. Resend key used for Trigger emails
Owner-provided key (re_9veG…) pushed to Trigger prod on 2026-08-29. Domain
open-mic.co.za verified. From: noreply@open-mic.co.za / "Open Mic Productions".
If production emails should come from a different address, update Trigger env
NEXT_PRIVATE_SMTP_FROM_ADDRESS / NEXT_PRIVATE_SMTP_FROM_NAME.

---
## 1b. Trusted Signatures production key — RESOLVED (2026-08-29 NIGHT)
Owner provided prod API Key ID `88e5bdbf-…` + secret. Set directly in Trigger
prod env (NOT Vercel, to avoid the write-only poisoning). Verified by direct API
probe: `api.trusted-signatures.com/v1/sign` returned HTTP 200 with a CMS
signature chained to "Trusted Signatures LLC". The seal job now signs with the
production Trusted Signatures HSM.

## 4. Trusted Signatures LOGO for the certificate — ACTION: owner
The cert (render-certificate.ts) now shows "Cryptographic signature by: Trusted
Signatures" and, if present, renders `public/static/trusted-signatures-logo.png`.
Drop the logo PNG at `apps/remix/public/static/trusted-signatures-logo.png`
(bundled into the Trigger worker via additionalFiles `./public/static`) so the
seal-job-generated certificate shows the image. Until then it shows the text
label only.
