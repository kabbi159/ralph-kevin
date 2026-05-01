#!/usr/bin/env bash
# Autonomous build session time tracker
# Window: 2026-05-01 13:00 KST – 16:30 KST
set -uo pipefail

DEADLINE_ISO="2026-05-01T16:30:00+0900"
START_ISO="2026-05-01T13:00:00+0900"
LOG_FILE="/Users/kevin/ralph-kevin/.claude/hooks/time-status.log"

deadline_ts=$(date -j -f "%Y-%m-%dT%H:%M:%S%z" "$DEADLINE_ISO" "+%s" 2>/dev/null || echo 0)
start_ts=$(date -j -f "%Y-%m-%dT%H:%M:%S%z" "$START_ISO" "+%s" 2>/dev/null || echo 0)
now_ts=$(date "+%s")

remaining=$((deadline_ts - now_ts))
elapsed=$((now_ts - start_ts))
total=$((deadline_ts - start_ts))

if [ "$remaining" -le 0 ]; then
  status="DEADLINE PASSED — 즉시 마무리하고 정리하세요"
  rh=0; rm_=0
elif [ "$remaining" -le 600 ]; then
  rh=$((remaining / 3600))
  rm_=$(((remaining % 3600) / 60))
  status="CRITICAL — 10분 이하 남음. 신규 기능 중단, 통합/검증/커밋만"
elif [ "$remaining" -le 1800 ]; then
  rh=$((remaining / 3600))
  rm_=$(((remaining % 3600) / 60))
  status="WARNING — 30분 이하 남음. 핵심 기능 마무리 우선"
else
  rh=$((remaining / 3600))
  rm_=$(((remaining % 3600) / 60))
  status="active"
fi

if [ "$elapsed" -lt 0 ]; then
  eh=0; em=0
  phase="아직 시작 전 (13:00 KST 시작 예정)"
elif [ "$elapsed" -ge "$total" ]; then
  eh=$((elapsed / 3600))
  em=$(((elapsed % 3600) / 60))
  phase="마감 경과"
else
  eh=$((elapsed / 3600))
  em=$(((elapsed % 3600) / 60))
  pct=$((elapsed * 100 / total))
  phase="진행 중 (${pct}% 경과)"
fi

current=$(TZ=Asia/Seoul date "+%Y-%m-%d %H:%M:%S KST")

# Append to log for visibility
echo "[$current] remaining=${rh}h${rm_}m elapsed=${eh}h${em}m status=${status}" >> "$LOG_FILE" 2>/dev/null || true

context="[자동 실행 시간 추적 — 작업 단위 체크포인트]
- 현재 시각: ${current}
- 세션 윈도우: 2026-05-01 13:00 ~ 16:30 KST (총 3시간 30분)
- 경과: ${eh}시간 ${em}분 (${phase})
- 남은 시간: ${rh}시간 ${rm_}분
- 상태: ${status}

지침: 남은 시간을 고려해 작업 우선순위를 결정하세요. 마감이 가까워질수록 신규 기능보다 통합·검증·커밋을 우선하세요."

jq -n --arg ctx "$context" '{
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: $ctx
  }
}'
