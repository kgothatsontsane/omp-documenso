# Triage state — the loop's persistent memory

| finding | source | priority | status |
|---------|--------|----------|--------|
| Sweeps moved off Vercel -> trigger.dev (proj_pgxztmkkgkbkaptgxtvk, task documenso-sweeps, cron */15 SAST) | cutover 2026-08-17 | high | DONE — VERIFIED: all 7 sweeps return "ok", querying Aiven DB, $0.0001/run |
| Aiven free DB: single connection | user requirement | high | DONE — connection_limit=1 on trigger.dev + Vercel env vars |
| Telemetry disable | user requirement | high | DONE — DOCUMENSO_DISABLE_TELEMETRY=true on Vercel (no redeploy) + trigger.dev |
| Production sign-in page: styled, fonts 200, logo 200, zero console errors | playwright evaluator (loop-engineering/checks/prod-signin.check.js) | medium | DONE |
| /fonts/* 404 — CSS loaded fonts from /fonts/ but vercel.json only routed /assets/ to static fn | playwright evaluator first pass | high | FIXED — added /fonts/(.*) -> /api/static route, deployed, fonts return 200 |
| CSS/JS assets return 200 (verified); custom logo 200 image/png | curl checks | done | DONE |
| Sweeps endpoint: auth 200 {"ok":true}, bad token 401, 25 rate-limit rows cleaned | vercel logs | done | SUPERSEDED — endpoint removed from Vercel, sweeps run on trigger.dev |
| Function sizes split: /api 86.12MB, /api/cron 45.91MB, /api/static 63.51MB | vercel deploy | done | DONE — /api/cron now removed entirely, only 2 functions remain |
| Trusted Signatures integration (trusted-signatures transport) | user requirement | high | DONE — ported transport + helpers, verified end-to-end signing works |
| **[2026-08-21 MORNING] Entire feature set UNCOMMITTED on working tree** — white-label (emails+logo), cache-header fix (api/static.mjs), inline sweep handlers (5 handlers), @trigger.dev SDK 4.5.12 bump, lingui-macro-stub.ts, .triggerignore, vercel.json /static route, prisma migration 20260819060000. Meanwhile 10 unpushed local commits on main include now-SUPERSEDED ConvertAPI work ("feat: add ConvertAPI fallback", "feat: enable DOCX conversion flag when ConvertAPI secret") that the uncommitted tree deletes. History is inconsistent. | git status + git log origin/main..HEAD | high | ACTIONABLE — commit/push PENDING user go-ahead. gitleaks detect: CLEAN (exit 0). Do NOT auto-commit (guard-rail). |
| **[2026-08-21 MORNING] CI has not validated any of these changes** — gh run list empty (nothing pushed to origin/main); workflows ci.yml/deploy.yml/e2e-tests.yml exist but never ran on this work. | gh run list (empty) | medium | BLOCKED on history reconciliation above |
| **[2026-08-21 MORNING] Stray temp file `render-check.tsx`** (root) untracked — leftover from email render verification, not a deliverable. | git status (??) | low | CLEANUP — remove |
| **[2026-08-21 MORNING] Live system GREEN** — Vercel aliased agreements.open-mic.co.za (deploys all Ready, cache headers immutable/HIT), trigger.dev v20260820.11 (3 tasks, sweeps inline-verified). No runtime regressions observed. | prior session verification | info | OK — no action |
