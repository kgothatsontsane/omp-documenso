#!/usr/bin/env bash
# Loop runner — implements the five moves of one turn.
# Usage: ./run_loop.sh [--check]   (--check runs the evaluator pass only)
#
# Guardrails (operational discipline):
#   LOOP_TOKEN_CAP   max tokens this run is allowed to spend (default 100000)
#   LOOP_MAX_TRIES   max generator/evaluator retries per task (default 2)
#   LOOP_INBOX       dir for anything the loop must not decide itself
set -euo pipefail

BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE="$BASE/state/triage.md"
INBOX="$BASE/inbox"
MAX_TRIES="${LOOP_MAX_TRIES:-2}"
TOKEN_CAP="${LOOP_TOKEN_CAP:-100000}"
DATE_STAMP="$(date '+%Y-%m-%d %H:%M')"

# --- 1. DISCOVERY ------------------------------------------------
# Read what the loop should look at this turn: the previous state file,
# plus anything the environment tells us (CI/issues/commits via env hooks).
mkdir -p "$BASE/state" "$INBOX"
if [[ ! -f "$STATE" ]]; then
  printf '| finding | source | priority | status |\n|---------|--------|----------|--------|\n' > "$STATE"
fi

echo "[loop] $DATE_STAMP — discovery: reading $STATE"
grep -v '^| finding' "$STATE" | grep -v '^|---' | grep '|' || true

# --- 2. HANDOFF ---------------------------------------------------
# Emit task lines. Each finding that is actionable gets its own isolated
# worktree (git) so parallel agents do not collide.
handle_task() {
  local slug="$1" task="$2"
  local wd="$BASE/worktrees/$slug"
  echo "[loop] handoff: $task (worktree $slug)"
  # Worktree isolation: clone or create a dedicated working dir per task.
  if git rev-parse --git-dir >/dev/null 2>&1; then
    git worktree add "$wd" -b "loop/$slug" 2>/dev/null || true
  else
    mkdir -p "$wd"
  fi
  echo "$wd"
}

# --- 3. GENERATION + 4. VERIFICATION ------------------------------
# Generator drafts, evaluator judges. The generator never grades itself.
generate_and_verify() {
  local wd="$1" task="$2" tries=0 verdict="REJECT"
  while [[ "$verdict" == "REJECT" && "$tries" -lt "$MAX_TRIES" ]]; do
    tries=$((tries + 1))
    echo "[loop] generator attempt $tries: $task"
    # INVOKE THE PROJECT SKILL HERE. For Open Mic, e.g.:
    #   claude --skill generate-contracts --worktree "$wd" "$task"
    # (Uncomment/replace with the real generator invocation.)
    :
    # EVALUATOR: assume broken until proven otherwise. Paste real output.
    #   claude --skill evaluate --worktree "$wd" "$task"
    # verdict="$(eval_result)"
    verdict="PENDING-HUMAN"   # placeholder: never auto-approve
  done
  echo "$verdict"
}

# --- 5. PERSISTENCE -----------------------------------------------
persist() {
  local slug="$1" status="$2" src="$3" prio="$4"
  printf '| %s | %s | %s | %s |\n' "$slug" "$src" "$prio" "$status" >> "$STATE"
  # Commit the state so tomorrow can read it.
  if git rev-parse --git-dir >/dev/null 2>&1; then
    git add "$STATE" 2>/dev/null && git commit -m "loop: persist state $DATE_STAMP" 2>/dev/null || true
  fi
}

# --- STOP (the human checkpoint) ----------------------------------
# The loop may execute; it cannot decide. Anything uncertain goes to the inbox.
stop_gate() {
  echo "[loop] human checkpoint: output above is PENDING human review."
  echo "[loop] anything uncertain goes to $INBOX — never auto-merge."
}

echo "[loop] token cap for this run: $TOKEN_CAP"
stop_gate
echo "[loop] turn complete $DATE_STAMP"
