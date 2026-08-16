# Loop Engineering Framework

> Distilled from *Loop Engineering: The Anthropic Playbook for Designing Systems That Prompt Your Agents* (HuaShu, 2026), which builds on Osmani, Steinberger, Cherny, Rajasekaran (generator/evaluator), and Kaliski (Stripe Minions).

## The One-Sentence Claim

Stop prompting the agent; design the system that prompts it — but build it like someone who intends to **stay the engineer**, not just the person who presses Go.

## The Four-Layer Stack

| Layer | Minds | Core question |
|-------|-------|---------------|
| Prompt engineering | One exchange | What should I tell the model? |
| Context engineering | One window | What goes in the window now? |
| Harness engineering | One run | Which tools/actions, what counts as done? |
| **Loop engineering** | **Scheduling on the harness** | **How to make it run itself, over and over** |

## The Five Moves of One Turn

Every turn must do all five. Skipping any one produces a specific failure.

| Move | What it does | Anti-pattern if skipped |
|------|-------------|-------------------------|
| **Discovery** | Find this turn's work on its own (CI failures, issues, commits, inbox) | **Blind loop** — a human still decides what it should do |
| **Handoff** | Hand each task to an agent in its own isolated worktree | **Tangled loop** — parallel agents collide on one directory |
| **Verification** | Swap in a *different* agent to say "no" | **Nodding loop** — the agent grades its own homework |
| **Persistence** | Write state outside the conversation (state file on disk) | **Amnesiac loop** — every morning starts from zero |
| **Scheduling** | Make the turn repeat on a timer/trigger | **Manual loop** — a script the human forgets to run |

## The Six Parts That Realize the Moves

| Part | What it is | Move it serves |
|------|-----------|----------------|
| **Automations** | Runs off a schedule/trigger (cron, CI, `/loop`) | Scheduling |
| **Worktrees** | Isolated dir per parallel agent | Handoff |
| **Skills** | Project knowledge made permanent in `SKILL.md` | Discovery |
| **Connectors** | MCP hooks to external systems | Persistence / Discovery |
| **Sub-agents** | Generator separated from the judge | Verification |
| **Memory** | Persistent state on disk | Persistence |

## Generator / Evaluator

The single most important structural rule: **the agent that writes must not be the agent that judges.**

- A generator asked to grade its own output tends to praise it — it sees the chain of self-persuasion, not the result.
- Tune a **separate, skeptical evaluator**: it carries none of the generator's context and defaults to doubt.
- **The evaluator must act, not just read** — run it, run the tests, click the button, take the screenshot. Judge behavior, not intent.
- **The final say goes to a fresh small model** on an explicit stop condition (`/goal all tests in test/auth pass and the lint step is clean`).

Evaluator stance (from the paper's reviewer agent):

```
ROLE: Adversarial code reviewer.
ASSUME: this code is BROKEN until proven otherwise.
DO NOT praise. Find what fails.
CHECK, in order:
  1. Does it run? (execute, don't read)
  2. Tests: run them, paste real output.
  3. Edge cases the author skipped.
  4. Does behavior match the ticket?
USE Playwright MCP: open the page, click, screenshot, inspect the DOM.
VERDICT: PASS only if every check holds. Otherwise REJECT + list each reason.
```

## The Four Costs ("four tabs that don't clear themselves")

They reinforce one another and all stay silent while the loop runs.

| Cost | What it is | Guard |
|------|-----------|-------|
| **Verification debt** | Unverified output accumulating between "runs" and "right" | An independent evaluator |
| **Comprehension rot** | Gap between what exists and what you understand | Read a representative sample daily and be able to explain it |
| **Cognitive surrender** | Stop having an opinion; take whatever it hands back | At least one human checkpoint ("keep one door open") |
| **Token blowout** | The bill from helpers/retries spinning all night | Hard caps set *before* shipping (per-run, daily, max retries) |

## Operational Discipline

1. **Read a sample, always** — read a representative sample of the loop's output every day and force yourself to explain each change (what and why). Inability to explain = your mental map has fallen behind.
2. **Cap before you ship** — set per-run budget, daily budget, max retries before the first unattended run. Caps are circuit breakers, not budget philosophy.
3. **Keep one door open** — build at least one checkpoint where the loop pauses for a human. The *existence* of the pause keeps you able to say "no" later.

## Growth Order

The loop *earns* the right to more parallelism by first proving it can stop a single bad agent.
1. Start with one finding handled end-to-end.
2. Widen discovery before widening parallelism.
3. Prove the evaluator catches real mistakes before trusting it to gate many agents.

## The First-Loop Checklist

| Element | Ask yourself |
|---------|-------------|
| Discovery | What does it read on a timer? |
| State file | Which disk file holds cross-round memory? |
| Evaluator | Is there an independent check that can say "no"? |
| Isolation | Does each parallel agent get its own worktree? |
| Token cap | Did you set a spending ceiling? Who stops it if it runs off? |
| Human review | Which step pauses for you to look? |
