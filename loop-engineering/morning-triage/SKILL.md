---
name: morning-triage
description: >
  The DISCOVERY move of the loop. Reads CI failures, open issues, recent commits,
  and the previous state file, judges what is worth acting on, persists findings
  to the state file, and emits handoff lines (worktree + stop condition) per kept
  finding. Anything uncertain goes to the inbox for a human.
trigger: invoked each morning by automation (cron / CI / loop runner).
---

# Morning Triage

## Read (the DISCOVERY inputs)

- CI runs that failed since the last run
- issues opened in the last 24 hours
- commits merged since the last run
- the previous `<project>/loop-engineering/state/triage.md` (what is still in flight)

## Judge (the part that sets the ceiling)

For each candidate, decide:
- is it actionable now, or noise? → skip noise, keep only actionable findings
- does it block a release? → priority
- is it already tracked in the state file? → skip (or update status)

Keep only what is worth a worktree today.

## Write (the PERSISTENCE output)

Append to `<project>/loop-engineering/state/triage.md`:

```
| finding | source | priority | status |
|---------|--------|----------|--------|
```

Commit the file so tomorrow can read it.

## Hand off (prepare the HANDOFF)

For each kept finding, emit a task line:

```
worktree=<slug> goal=<stop-condition> task="<one line of work>"
```

## Verify (the VERIFICATION move)

Before anything lands:
- a **separate evaluator** (see `<project>/loop-engineering/agents/evaluator.md`) reviews each output
- the evaluator assumes the work is BROKEN until proven otherwise and ACTS to verify (runs the test / executes the step / opens the doc), it does not just read
- pass the final say to a fresh judgment on the stop condition

## Stop (the boundary you keep for yourself)

- Never merge automatically. Never delete.
- Anything you are less than confident about goes to `<project>/loop-engineering/inbox/` for a human, not into the output.
- The loop may execute; it cannot decide.
