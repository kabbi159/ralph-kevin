import {
  type FrictionSignal,
  type FrictionSignalType,
  type PersonaUXProfile,
  type RunEvent,
  type UXFinding,
  newFindingId,
} from "@personabench/core";
import { renderFixPrompt } from "./fix-prompt";
import { severityFor } from "./severity";

// Cluster FrictionSignals into UXFindings. Strategy: one finding per
// distinct signal type per persona, citing every signal of that type.
// Heuristic but deterministic — the analyzer is byte-stable across runs
// over the same event log.

export type AggregateOpts = {
  signals: FrictionSignal[];
  events: RunEvent[];
  persona: PersonaUXProfile;
  runId: string;
  targetUrl: string;
  task: string;
};

const TITLE_BY_TYPE: Record<FrictionSignalType, string> = {
  long_hesitation: "사용자가 화면 앞에서 멈칫거림",
  repeated_click: "동일 위치 반복 클릭 — 응답 부족",
  dead_click: "클릭에 반응 없음 (dead click)",
  backtrack: "사용자가 뒤로 가기 / 흐름 되돌림",
  form_error: "양식 오류 / 진행 차단",
  scroll_search: "스크롤 탐색 — 원하는 요소를 찾지 못함",
  task_abandonment: "사용자가 작업을 포기함",
  cta_not_found: "다음 단계 CTA를 인지하지 못함",
  copy_confusion: "문구 혼동",
  price_uncertainty: "최종 결제 금액이 모호함",
  trust_uncertainty: "신뢰성 / 환불 정책 우려로 멈칫거림",
};

const RECOMMENDATION_BY_TYPE: Record<
  FrictionSignalType,
  { uxChange: string; criteria: string[]; implementationHint?: string }
> = {
  long_hesitation: {
    uxChange:
      "Reduce the cognitive load at the hesitation point — surface the next-step affordance more visibly, or break the screen into smaller commits.",
    criteria: ["Persona reaches the next step within 5 seconds of arrival on this screen."],
  },
  repeated_click: {
    uxChange:
      "Show immediate feedback for clicks — disable the control after the first click and indicate progress.",
    criteria: ["Clicking the affected control twice produces no duplicate side-effects."],
  },
  dead_click: {
    uxChange: "Either make the control responsive on click or remove its visual button affordance.",
    criteria: [
      "The clicked element either changes state visibly within 200 ms or is no longer a button.",
    ],
  },
  backtrack: {
    uxChange: "Make the prior screen retain context so the user does not need to retrace.",
    criteria: ["Going back and returning preserves form values and scroll position."],
  },
  form_error: {
    uxChange:
      "Show inline validation as the user types; the submit button must explain why it is disabled.",
    criteria: ["Disabled submit shows a tooltip / inline message naming the missing field."],
  },
  scroll_search: {
    uxChange: "Pin the primary action and total to the bottom of the viewport on mobile.",
    criteria: ["The user finds the next CTA without scrolling more than once."],
  },
  task_abandonment: {
    uxChange: "Identify the trigger of the drop-off and address it.",
    criteria: ["Persona reaches the success state without abandoning."],
  },
  cta_not_found: {
    uxChange: "Make the primary CTA the highest-contrast element on the screen.",
    criteria: [
      "Primary CTA is identified by the persona within 3 seconds of arriving on the screen.",
    ],
  },
  copy_confusion: {
    uxChange: "Rewrite the ambiguous copy in plain language.",
    criteria: ["Persona can paraphrase what the next step does in their own words."],
  },
  price_uncertainty: {
    uxChange:
      "Show a precise final total. Remove any '약/approximately/~' suffix. Display shipping and any other fees as line items above the total.",
    criteria: [
      "The displayed total matches the actual amount the persona will be charged.",
      "All shipping / service / coupon adjustments are itemized above the total.",
    ],
    implementationHint: "Remove the '약 ~원' wrapper and unfold the shipping panel by default.",
  },
  trust_uncertainty: {
    uxChange: "Surface refund / cancellation links near the commit step.",
    criteria: ["Persona can find the refund policy without leaving the checkout flow."],
  },
};

export const aggregateFindings = (opts: AggregateOpts): UXFinding[] => {
  const { signals, events, persona, runId, targetUrl, task } = opts;
  const byType = new Map<FrictionSignalType, FrictionSignal[]>();
  for (const s of signals) {
    const list = byType.get(s.type) ?? [];
    list.push(s);
    byType.set(s.type, list);
  }

  const eventsById = new Map(events.map((e) => [e.id, e]));
  const findings: UXFinding[] = [];

  let idx = 0;
  for (const [type, group] of byType) {
    if (group.length === 0) continue;
    const eventIds = Array.from(new Set(group.flatMap((s) => s.evidence.eventIds))).filter((id) =>
      eventsById.has(id),
    );
    if (eventIds.length === 0) continue;
    const screenshots = Array.from(new Set(group.flatMap((s) => s.evidence.screenshotPaths ?? [])));
    const timestamps = group.map((s) => new Date(s.timestampStartMs).toISOString());
    const severity = severityFor(group);
    const rec = RECOMMENDATION_BY_TYPE[type];
    const titleBase = TITLE_BY_TYPE[type];

    const finding: UXFinding = {
      id: newFindingId(idx),
      runId,
      severity,
      title: titleBase,
      summary: `${titleBase} (${group.length} signal${group.length > 1 ? "s" : ""}).`,
      persona: { id: persona.personaId, displayName: persona.displayName },
      evidence: {
        timestamps,
        eventIds,
        frictionSignalIds: group.map((s) => s.id),
        screenshots: screenshots.length > 0 ? screenshots : undefined,
      },
      diagnosis: {
        userGoal: `Complete the task: "${task}"`,
        observedBehavior: group.map((s) => s.evidence.notes).join(" "),
        likelyCause: TITLE_BY_TYPE[type],
        confidence:
          severity === "critical"
            ? 0.9
            : severity === "high"
              ? 0.8
              : severity === "medium"
                ? 0.65
                : 0.5,
      },
      recommendation: {
        uxChange: rec.uxChange,
        implementationHint: rec.implementationHint,
        acceptanceCriteria: rec.criteria,
      },
      codingAgentPrompt: "(see fix-prompts/F-NNN.md)",
    };

    finding.codingAgentPrompt = renderFixPrompt({
      finding,
      persona,
      targetUrl,
      task,
      signalTypes: [type],
    });
    findings.push(finding);
    idx++;
  }

  // Sort by severity (critical → low) for stable report ordering.
  const order = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  // Re-id sequentially so F-001 is always the most-severe finding.
  return findings.map((f, i) => ({ ...f, id: newFindingId(i) }));
};
