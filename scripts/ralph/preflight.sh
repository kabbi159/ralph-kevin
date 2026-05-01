#!/usr/bin/env bash
# Ralph preflight — runs at the start of every iteration.
# Verifies the workspace is in a sane state before the iteration body executes.
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "▶ Ralph preflight @ $(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S KST')"

# 1. Branch must be develop (the only branch the loop owns)
branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" != "develop" ]; then
  echo "✘ preflight: not on develop (current: $branch). Aborting." >&2
  exit 2
fi
echo "  ✓ branch=develop"

# 2. Working tree must be clean OR contain only expected untracked dirs
dirty=$(git status --porcelain)
if [ -n "$dirty" ]; then
  echo "  ⚠ working tree has changes:"
  echo "$dirty" | sed 's/^/    /'
  echo "  (this is OK at iteration start if the previous iteration left WIP — verify before proceeding)"
fi

# 3. Required state files exist
required=(.ralph/prd.json .ralph/status.json .ralph/progress.md .ralph/learnings.md .ralph/steering.md AGENTS.md docs/01_PRD.md)
for f in "${required[@]}"; do
  if [ ! -f "$f" ]; then
    echo "✘ preflight: missing $f" >&2
    exit 2
  fi
done
echo "  ✓ ralph state files present"

# 4. Time budget hook is wired
if [ ! -x .claude/hooks/time-status.sh ]; then
  echo "✘ preflight: .claude/hooks/time-status.sh missing or not executable" >&2
  exit 2
fi
echo "  ✓ time-status hook executable"

# 5. node + pnpm versions
node_v=$(node --version 2>/dev/null || echo "missing")
pnpm_v=$(pnpm --version 2>/dev/null || echo "missing")
echo "  ✓ node=$node_v pnpm=$pnpm_v"

# 6. Echo current ralph state
phase=$(jq -r '.currentPhase' .ralph/status.json)
task=$(jq -r '.currentTaskId' .ralph/status.json)
iter=$(jq -r '.iteration' .ralph/status.json)
sig=$(jq -r '.timeBudgetSignal' .ralph/status.json)
echo "  ➜ iteration=$iter phase=$phase task=$task signal=$sig"

echo "✓ preflight OK"
