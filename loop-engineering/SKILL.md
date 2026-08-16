---
name: loop-engineering
description: >
  The Loop Engineering playbook — reusable across any project. Load when
  designing, building, running, or auditing an agent loop. Covers the five moves,
  the six parts, the generator/evaluator split, the four costs, the five
  anti-patterns, operational discipline, and the morning-triage loop. Base file:
  <project>/loop-engineering/FRAMEWORK.md.
trigger: designing a loop, morning triage, review/evaluate a loop, "make it run itself", scheduler, worktree, generator/evaluator, verification debt, token caps.
---

# Loop Engineering Skill

Follow `<project>/loop-engineering/FRAMEWORK.md` for the full playbook. This file is the operational quick-reference.

## Install into a new project

Copy this whole skill directory into the project as `loop-engineering/` (or
create it from `SKELETON.md`). All paths below are relative to the project root.

## Before building any loop, run the six-part checklist

1. **Scheduling** — a real trigger (cron, CI schedule, /loop), not a wall of instructions. The trigger invokes a **named skill**, never a giant prompt nobody updates.
2. **Discovery** — a skill that finds its own work (CI failures, open issues, recent commits, the previous state file).
3. **Persistence** — a state file on disk (`loop-engineering/state/`), committed back each round. The agent forgets; the repo does not.
4. **Handoff** — one isolated worktree per task so parallel agents do not collide.
5. **Verification** — a separate evaluator agent that defaults to doubt and acts to verify (runs tests, executes, screenshots). The generator never grades itself.
6. **Human review** — a checkpoint that pauses for a human; never auto-merge. Uncertain items go to `loop-engineering/inbox/`.

## Guards installed by default (operational discipline)

- **Cap before you ship:** per-run token budget, daily budget, max retries. Set them before the first unattended run.
- **Read a sample, always:** each day, read a representative sample of loop output and be able to explain it. If you cannot explain a change, update your mental map before merging more.
- **Keep one door open:** the loop may execute, but it cannot decide. At least one human pause must exist.

## Anti-pattern check (which move is skipped?)

| Symptom | Skipped move |
|---------|-------------|
| Never once said "no" across many turns | Verification (nodding loop) |
| No cumulative progress, restarts daily | Persistence (amnesiac loop) |
| A human still picks the work each morning | Discovery (blind loop) |
| Parallel agents collide / messy merges | Handoff (tangled loop) |
| Runs only the day it was demoed | Scheduling (manual loop) |

## When running the loop

- Run `loop-engineering/run_loop.sh` for a manual pass, or wire the trigger (cron / CI / /loop) so it runs unattended.
- Each round: discover → triage → hand off to worktrees → evaluate → persist to state → schedule next round.
- Record observations in `loop-engineering/LESSONS.md` so the skeleton improves from practice — in this project and in the shared copy.
