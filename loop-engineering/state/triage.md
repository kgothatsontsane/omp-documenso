# Triage state — the loop's persistent memory

| finding | source | priority | status |
|---------|--------|----------|--------|
| cron-job.org job not configured (URL, Bearer header, 15-min schedule) | prior deployment work | high | PENDING-HUMAN — needs user's cron-job.org session/API key |
| Production sign-in page: styled, fonts 200, logo 200, zero console errors | playwright evaluator (loop-engineering/checks/prod-signin.check.js) | medium | DONE |
| /fonts/* 404 — CSS loaded fonts from /fonts/ but vercel.json only routed /assets/ to static fn | playwright evaluator first pass | high | FIXED — added /fonts/(.*) -> /api/static route, deployed, fonts return 200 |
| CSS/JS assets return 200 (verified); custom logo 200 image/png | curl checks | done | DONE |
| Sweeps endpoint: auth 200 {"ok":true}, bad token 401, 25 rate-limit rows cleaned | vercel logs | done | DONE |
| Function sizes split: /api 86.12MB, /api/cron 45.91MB, /api/static 63.51MB | vercel deploy | done | DONE |
