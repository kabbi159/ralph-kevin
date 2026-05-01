#!/usr/bin/env bash
# Ralph verify — runs the four global gates after a task body completes.
# Exit 0 only if all four pass. The commit body's `Verification:` block
# should reflect each gate's pass/fail.
set -uo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

OUT=".ralph/iteration-logs"
mkdir -p "$OUT"
TS=$(date +%Y%m%d-%H%M%S)
LOG="$OUT/verify-$TS.log"

step () {
  local name="$1" ; shift
  echo "▶ $name"
  echo "─── $name ───" >> "$LOG"
  "$@" >> "$LOG" 2>&1
  local ec=$?
  if [ "$ec" -eq 0 ]; then
    echo "  ✓ $name"
  else
    echo "  ✘ $name (exit=$ec) — see $LOG"
  fi
  return $ec
}

failures=0

step "pnpm install (frozen lockfile if present)" pnpm install --prefer-offline || failures=$((failures+1))
step "pnpm build" pnpm build || failures=$((failures+1))
step "pnpm typecheck" pnpm typecheck || failures=$((failures+1))
step "pnpm lint:check" pnpm lint:check || failures=$((failures+1))
step "pnpm test" pnpm test || failures=$((failures+1))

echo
if [ "$failures" -eq 0 ]; then
  echo "✓ verify: all gates green ($LOG)"
  exit 0
else
  echo "✘ verify: $failures gate(s) red ($LOG)"
  exit 1
fi
