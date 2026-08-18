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
