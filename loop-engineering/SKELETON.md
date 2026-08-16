# Generic Loop Skeleton

A minimal, complete loop that installs all six parts. Copy this skeleton for any
new loop engineering project, then fill in the project-specific bits in `[brackets]`.
Keep it small; earn more parallelism only after the checks have caught real mistakes.

## 1. SCHEDULING — a real trigger

```yaml
# .github/workflows/triage.yml  (cloud; runs even when the machine is off)
on:
  schedule:
    - cron: '0 6 * * *'   # 06:00 daily
jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - run: claude --skill morning-triage
```

Local alternative: `loop-engineering/run_loop.sh` on a desktop timer (needs the
machine on; gives sub-minute frequency and local file access).

## 2. DISCOVERY — a skill, not a wall of text

The trigger invokes `morning-triage/SKILL.md` — permanent, maintained knowledge.
It reads CI failures, open issues, recent commits, and the previous state file.

## 3. PERSISTENCE — state on disk

```markdown
# state/triage.md   (the loop's memory; committed back each round)
| finding | source | priority | status |
|---------|--------|----------|--------|
```

The agent forgets; the repo does not.

## 4. HANDOFF — one worktree per finding

```bash
for finding in $(parse ./state/triage.md); do
  claude --worktree "fix/$finding" \
         --goal "[stop condition for this finding]" \
         "draft a fix for $finding"
done
```

## 5. VERIFICATION — a fresh agent judges

- A separate evaluator (agents/evaluator.md) reviews each output; it assumes the
  work is broken and ACTS to verify.
- The generator never grades itself.
- Final say on a stop condition judged by a fresh model.

## 6. HUMAN REVIEW — the open door

- Open PRs / outputs, never auto-merge.
- Anything uncertain lands in `inbox/` for a human.
- The loop may execute; it cannot decide.

## First-loop checklist before you ship

- [ ] Discovery: what does it read on a timer?
- [ ] State file: which disk file holds cross-round memory?
- [ ] Evaluator: is there an independent check that can say "no"?
- [ ] Isolation: does each parallel agent get its own worktree?
- [ ] Token cap: did you set a spending ceiling? Who stops it if it runs off?
- [ ] Human review: which step pauses for you to look?
