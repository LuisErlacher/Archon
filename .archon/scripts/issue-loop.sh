#!/usr/bin/env bash
# Issue Loop - processes all open GitHub issues serially via archon-idea-to-pr-pi (GLM-5.1).
# Every workflow uses GLM-5.1; conflicts are logged for human review.
#
# Usage: bash .archon/scripts/issue-loop.sh
#
# State files:
#   .archon/loop-state/queue.txt       — issues remaining (one number per line)
#   .archon/loop-state/done.log        — successfully merged
#   .archon/loop-state/failed.log      — workflow failed or no PR created
#   .archon/loop-state/conflicts.log   — PR created but merge to dev had conflicts
#   .archon/loop-state/loop.log        — full chronological log

set -uo pipefail

REPO="LuisErlacher/Archon"
WORKFLOW="archon-idea-to-pr-pi"
BASE_BRANCH="dev"
STATE_DIR=".archon/loop-state"
QUEUE="$STATE_DIR/queue.txt"
DONE_LOG="$STATE_DIR/done.log"
FAILED_LOG="$STATE_DIR/failed.log"
CONFLICTS_LOG="$STATE_DIR/conflicts.log"
LOOP_LOG="$STATE_DIR/loop.log"
MAX_WAIT_SEC=7200  # 2h hard cap per issue

mkdir -p "$STATE_DIR"

log() {
  local msg="[$(date -Iseconds)] $*"
  echo "$msg" | tee -a "$LOOP_LOG"
}

# Initialize queue if missing
if [[ ! -f "$QUEUE" ]]; then
  log "Initializing queue from open issues in $REPO"
  gh issue list -R "$REPO" --limit 200 --json number --state open \
    | jq -r '.[].number' | sort -n > "$QUEUE"
  log "Queue initialized with $(wc -l < "$QUEUE") issues"
fi

while true; do
  issue=$(head -1 "$QUEUE" 2>/dev/null || true)
  if [[ -z "$issue" ]]; then
    log "=== Queue empty — all issues processed ==="
    break
  fi

  log "=== Issue #$issue — start ==="
  branch="fix/issue-$issue"

  # Fetch title for context
  title=$(gh issue view "$issue" -R "$REPO" --json title -q .title 2>/dev/null || echo "(title fetch failed)")
  log "Issue #$issue: \"$title\""

  # Skip if PR for this branch already exists
  existing_pr=$(gh pr list -R "$REPO" --head "$branch" --state all --json number,state -q '.[0]' 2>/dev/null || echo "")
  if [[ -n "$existing_pr" && "$existing_pr" != "null" ]]; then
    pr_num=$(echo "$existing_pr" | jq -r .number)
    pr_state=$(echo "$existing_pr" | jq -r .state)
    log "Issue #$issue: PR #$pr_num already exists (state=$pr_state), skipping workflow run"
  else
    log "Issue #$issue: dispatching workflow $WORKFLOW (timeout ${MAX_WAIT_SEC}s)"
    # Run workflow with a hard wall-clock timeout
    timeout "$MAX_WAIT_SEC" bun run cli workflow run "$WORKFLOW" --branch "$branch" \
      "Fix issue #$issue: $title" >> "$LOOP_LOG" 2>&1
    rc=$?
    log "Issue #$issue: workflow exit code $rc"
    if [[ $rc -ne 0 ]]; then
      log "Issue #$issue: workflow failed (rc=$rc)"
      echo "$issue rc=$rc" >> "$FAILED_LOG"
      sed -i '1d' "$QUEUE"
      continue
    fi
  fi

  # Find resulting PR
  pr=$(gh pr list -R "$REPO" --head "$branch" --state open --json number -q '.[0].number' 2>/dev/null || true)
  if [[ -z "$pr" || "$pr" == "null" ]]; then
    log "Issue #$issue: no open PR found after workflow"
    echo "$issue no-pr" >> "$FAILED_LOG"
    sed -i '1d' "$QUEUE"
    continue
  fi
  log "Issue #$issue: PR #$pr found, marking ready"
  gh pr ready "$pr" -R "$REPO" >> "$LOOP_LOG" 2>&1 || true

  # Wait briefly so CI can register
  sleep 5

  # Attempt merge to dev (squash, delete branch). --auto requires CI; we use direct merge.
  log "Issue #$issue: attempting merge of PR #$pr → $BASE_BRANCH"
  if gh pr merge "$pr" -R "$REPO" --merge --delete-branch >> "$LOOP_LOG" 2>&1; then
    log "Issue #$issue: PR #$pr merged into $BASE_BRANCH"
    echo "$issue PR-$pr" >> "$DONE_LOG"
    gh issue close "$issue" -R "$REPO" -c "Closed by automated PR #$pr (merged into $BASE_BRANCH)" >> "$LOOP_LOG" 2>&1 || true
  else
    log "Issue #$issue: merge of PR #$pr FAILED — likely conflict, marked for human review"
    echo "$issue PR-$pr conflict" >> "$CONFLICTS_LOG"
  fi

  # Pop from queue
  sed -i '1d' "$QUEUE"
  remaining=$(wc -l < "$QUEUE")
  log "Issue #$issue: done — $remaining issues remaining"

  # Brief pause between issues
  sleep 10
done

log "=== ALL DONE ==="
log "Done: $(wc -l < "$DONE_LOG" 2>/dev/null || echo 0)"
log "Failed: $(wc -l < "$FAILED_LOG" 2>/dev/null || echo 0)"
log "Conflicts: $(wc -l < "$CONFLICTS_LOG" 2>/dev/null || echo 0)"
