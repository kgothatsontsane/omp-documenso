# LESSONS — the continuously-updated observation log

This file is the loop's memory for *how the loop itself behaves*. Every time a
round goes right or wrong, record the observation here so the skeleton improves
from practice. Each new loop engineering project should copy this file.

## How to log

- **What happened** (one line, factual)
- **Which move/cost/part it touched**
- **What to change in SKELETON.md / SKILL.md as a result**

## Observations

<!--
Template:
- **What happened:** ...
- **Move/cost:** ...
- **Change to make:** ...
-->

## Documenso on Vercel Hobby (2026-08)

- **What happened:** watch-skill/the-loop loop_start timed out navigating to the prod site (30s goto) and needs `WATCHSKILL_ANTHROPIC_API_KEY` — it's built for video, not web verification.
- **Move/cost:** Verification.
- **Change to make:** Use the loop-engineering evaluator with Playwright (webapp-testing) for web targets, not watch-skill. "watch skill is for videos... use playwright."
- **What happened:** The /api function was 291.33MB, over Hobby's 250MB cap.
- **Move/cost:** Verification debt.
- **Change to make:** Split into separate functions via vercel.json (main/cron/static) before checking sizes; check `size_download`/function size after each deploy.
- **What happened:** cron-job.org can't be edited programmatically without an API key/session; user must configure the job.
- **Move/cost:** Scheduling (manual loop risk).
- **Change to make:** Keep the cron job config as a PENDING-HUMAN finding in state/triage.md with exact URL/header/schedule, never auto-approve.
- **What happened:** Cold starts on Vercel Hobby exceed 30s page-load timeouts occasionally.
- **Move/cost:** Verification.
- **Change to make:** In evaluator, retry/wait-once for cold start before judging the page broken.
- **What happened:** trigger.dev esbuild bundling of the sweep handlers failed on native/asset modules (skia-canvas .node, playwright/chromium-bidi, .po files) and then on externalized @prisma/client ESM named-export interop.
- **Move/cost:** Verification debt — repeated deploy cycles on the same bundle.
- **Change to make:** Keep native/asset packages external in trigger.config.ts build.external; NEVER externalize @prisma/client (bundle it so esbuild does CJS->ESM interop; keep @prisma/engines external for platform binaries); stub .po files via an esbuildPlugin onLoad since prod uses compiled .mjs. Verify with a local `npx esbuild --bundle` of the task file BEFORE deploying.
- **What happened:** The trigger.dev runs verification API rabbit-hole (runs endpoints 401/500/"Invalid user-actor token") cost many cycles.
- **Move/cost:** Verification.
- **Change to make:** Use the SDK directly: `configure({ secretKey: TRIGGER_PAT })` then `runs.list('<projectRef>', { env: 'prod', limit })` — the first string arg is projectRef, NOT env. Works with the stored personal access token.
- **What happened:** Vercel cron endpoint /api/cron/sweeps and cron-job.org job were the sweep triggers; sweeps consumed Hobby CPU at the 4 CPU-hr/month ceiling.
- **Move/cost:** Scheduling (externalized).
- **Change to make:** Move recurring DB sweeps to trigger.dev schedules.task with cron + timezone; verify runs via SDK; then remove the Vercel cron function (vercel.json function+route, build.sh build:cron, api/cron.mjs, rollup.cron.config.mjs) and disable cron-job.org job via PATCH /jobs/{id} {"job":{"enabled":false}}.

