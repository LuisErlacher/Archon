#!/usr/bin/env bash
# Overnight Spec Loop — processes specs/003*.md → specs/024*.md sequentially.
# Each spec: dispatches archon-gsd-feature-pi (GLM-5.1) → waits for completion
# → detects PR → merges to dev → next spec.
#
# Designed for unattended overnight execution. Use:
#   nohup bash .archon/scripts/spec-loop-overnight.sh > /dev/null 2>&1 &
#   disown
#
# State files:
#   .archon/loop-state/spec-queue.txt    — specs remaining (one filename per line)
#   .archon/loop-state/spec-done.log     — successfully merged
#   .archon/loop-state/spec-failed.log   — workflow failed or no PR
#   .archon/loop-state/spec-conflict.log — PR created but merge failed
#   .archon/loop-state/spec-loop.log     — full chronological log

set -uo pipefail

cd "$(dirname "$0")/../.." || exit 1

REPO="LuisErlacher/Archon"
WORKFLOW="archon-gsd-feature-pi"
BASE_BRANCH="dev"
FOUNDATION_BRANCH="feat/pi-ai-foundation-and-specs"
STATE_DIR=".archon/loop-state"
QUEUE="$STATE_DIR/spec-queue.txt"
DONE_LOG="$STATE_DIR/spec-done.log"
FAILED_LOG="$STATE_DIR/spec-failed.log"
CONFLICT_LOG="$STATE_DIR/spec-conflict.log"
LOOP_LOG="$STATE_DIR/spec-loop.log"
MAX_WAIT_SEC=5400  # 90 min hard cap per spec

mkdir -p "$STATE_DIR"

log() {
  local msg="[$(date -Iseconds)] $*"
  echo "$msg" | tee -a "$LOOP_LOG"
}

# Initialize queue if missing or empty
if [[ ! -s "$QUEUE" ]]; then
  log "Initializing queue with all specs/003-024"
  ls specs/00[3-9]*.md specs/01*.md specs/02*.md 2>/dev/null | sort > "$QUEUE"
  log "Queue: $(wc -l < "$QUEUE") specs"
fi

log "=== OVERNIGHT SPEC LOOP STARTED (PID $$) ==="
log "Foundation branch: $FOUNDATION_BRANCH"
log "Target merge branch: $BASE_BRANCH"
log "Max wait per spec: ${MAX_WAIT_SEC}s"

while [[ -s "$QUEUE" ]]; do
  spec_path=$(head -1 "$QUEUE")
  spec_name=$(basename "$spec_path" .md)
  branch="feat/$spec_name"

  log ""
  log "════════════════════════════════════════════════════════════════"
  log "Processing: $spec_path"
  log "Branch: $branch"
  log "Remaining: $(wc -l < "$QUEUE") (including this one)"
  log "════════════════════════════════════════════════════════════════"

  # Skip if PR for this branch already exists
  existing_pr=$(gh pr list --repo "$REPO" --head "$branch" --state all --json number,state 2>/dev/null | jq -r '.[0].number // empty')
  if [[ -n "$existing_pr" ]]; then
    log "Spec $spec_name: PR #$existing_pr already exists, skipping workflow"
  else
    # Read spec content
    spec_content=$(cat "$spec_path")
    log "Spec $spec_name: dispatching $WORKFLOW (timeout ${MAX_WAIT_SEC}s)"

    # Run workflow with the spec as input
    timeout "$MAX_WAIT_SEC" bun run cli workflow run "$WORKFLOW" \
      --branch "$branch" --from "$FOUNDATION_BRANCH" \
      "Implementar a spec a seguir, criando todos os arquivos novos e modificando os existentes conforme indicado. NUNCA usar bash heredoc para arquivos grandes — sempre usar a tool write. Spec:

$spec_content" >> "$LOOP_LOG" 2>&1
    rc=$?
    log "Spec $spec_name: workflow exit code $rc"
    if [[ $rc -ne 0 ]]; then
      log "Spec $spec_name: workflow failed (rc=$rc)"
      echo "$spec_name rc=$rc" >> "$FAILED_LOG"
      sed -i '1d' "$QUEUE"
      sleep 5
      continue
    fi
  fi

  # Find PR
  pr=$(gh pr list --repo "$REPO" --head "$branch" --state open --json number 2>/dev/null | jq -r '.[0].number // empty')
  if [[ -z "$pr" ]]; then
    log "Spec $spec_name: no open PR found after workflow"
    echo "$spec_name no-pr" >> "$FAILED_LOG"
    sed -i '1d' "$QUEUE"
    sleep 5
    continue
  fi

  log "Spec $spec_name: PR #$pr found, marking ready"
  gh pr ready "$pr" --repo "$REPO" >> "$LOOP_LOG" 2>&1 || true
  sleep 10  # Let CI register

  # Attempt merge to dev
  log "Spec $spec_name: attempting merge of PR #$pr → $BASE_BRANCH"
  if gh pr merge "$pr" --repo "$REPO" --merge --delete-branch >> "$LOOP_LOG" 2>&1; then
    log "Spec $spec_name: ✅ PR #$pr merged into $BASE_BRANCH"
    echo "$spec_name PR-$pr" >> "$DONE_LOG"
  else
    log "Spec $spec_name: ❌ merge of PR #$pr FAILED — likely conflict, marked for human review"
    echo "$spec_name PR-$pr conflict" >> "$CONFLICT_LOG"
  fi

  # Pop from queue
  sed -i '1d' "$QUEUE"

  log "Spec $spec_name: done — $(wc -l < "$QUEUE") specs remaining"
  sleep 15  # Brief pause between specs
done

log ""
log "════════════════════════════════════════════════════════════════"
log "=== ALL SPECS PROCESSED — LOOP COMPLETE ==="
log "Done: $(wc -l < "$DONE_LOG" 2>/dev/null || echo 0)"
log "Failed: $(wc -l < "$FAILED_LOG" 2>/dev/null || echo 0)"
log "Conflicts: $(wc -l < "$CONFLICT_LOG" 2>/dev/null || echo 0)"
log "════════════════════════════════════════════════════════════════"
