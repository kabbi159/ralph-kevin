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
  // Default 'ko' — the persona dataset locked in for this build is
  // nvidia/Nemotron-Personas-Korea. Pass 'en' for English reports.
  lang?: "ko" | "en";
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

type Lang = "ko" | "en";

type Recommendation = { uxChange: string; criteria: string[]; implementationHint?: string };

const RECOMMENDATION_KO: Record<FrictionSignalType, Recommendation> = {
  long_hesitation: {
    uxChange:
      "사용자가 멈칫거리는 지점의 인지 부담을 줄여라 — 다음 단계 어포던스를 더 눈에 띄게 표시하거나 화면을 작은 커밋 단위로 분할하라.",
    criteria: ["페르소나가 화면 도달 후 5초 안에 다음 단계로 진행한다."],
  },
  repeated_click: {
    uxChange: "클릭 즉시 피드백을 보여라 — 첫 클릭 후 컨트롤을 비활성화하고 진행 상태를 표시하라.",
    criteria: ["같은 컨트롤을 두 번 클릭해도 부작용이 중복되지 않는다."],
  },
  dead_click: {
    uxChange: "클릭에 반응하도록 만들거나, 버튼처럼 보이는 시각적 어포던스를 제거하라.",
    criteria: [
      "클릭한 요소는 200ms 안에 가시적 상태 변화를 보이거나 더 이상 버튼처럼 보이지 않는다.",
    ],
  },
  backtrack: {
    uxChange: "이전 화면이 맥락을 유지하도록 하여 사용자가 되돌아가지 않게 하라.",
    criteria: ["뒤로 가기 후 다시 돌아왔을 때 폼 값과 스크롤 위치가 보존된다."],
  },
  form_error: {
    uxChange:
      "사용자가 타이핑하는 동안 인라인 검증을 보여라; 비활성화된 제출 버튼은 그 이유를 명시해야 한다.",
    criteria: ["비활성화된 제출 버튼은 누락된 필드를 명시하는 툴팁/인라인 메시지를 표시한다."],
  },
  scroll_search: {
    uxChange: "모바일에서는 주요 액션과 합계를 뷰포트 하단에 고정하라.",
    criteria: ["사용자가 한 번 이상 스크롤하지 않고도 다음 CTA를 찾는다."],
  },
  task_abandonment: {
    uxChange: "드롭오프의 직접 원인을 찾아 해결하라.",
    criteria: ["페르소나가 작업을 포기하지 않고 성공 상태에 도달한다."],
  },
  cta_not_found: {
    uxChange: "주요 CTA를 화면에서 가장 대비가 강한 요소로 만들어라.",
    criteria: ["페르소나가 화면 도달 후 3초 안에 주요 CTA를 식별한다."],
  },
  copy_confusion: {
    uxChange: "모호한 문구를 평이한 언어로 다시 써라.",
    criteria: ["페르소나가 다음 단계의 동작을 자신의 말로 다시 설명할 수 있다."],
  },
  price_uncertainty: {
    uxChange:
      "정확한 최종 합계를 표시하라. '약/approximately/~' 접미사를 제거하라. 배송비와 기타 수수료를 합계 위 항목으로 노출하라.",
    criteria: [
      "표시된 합계가 페르소나에게 실제로 청구될 금액과 일치한다.",
      "배송/서비스/쿠폰 조정 항목이 모두 합계 위에 별도 라인으로 표시된다.",
    ],
    implementationHint: "'약 ~원' 래퍼를 제거하고 배송 정보 패널을 기본으로 펼쳐라.",
  },
  trust_uncertainty: {
    uxChange: "결제 단계 근처에 환불/취소 정책 링크를 노출하라.",
    criteria: ["페르소나가 체크아웃 흐름을 떠나지 않고도 환불 정책을 찾을 수 있다."],
  },
};

const RECOMMENDATION_EN: Record<FrictionSignalType, Recommendation> = {
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

const recommendationsFor = (lang: Lang) => (lang === "en" ? RECOMMENDATION_EN : RECOMMENDATION_KO);

const goalLabel = (lang: Lang, task: string) =>
  lang === "en" ? `Complete the task: "${task}"` : `다음 작업을 완료한다: "${task}"`;

const summaryFor = (lang: Lang, title: string, count: number): string =>
  lang === "en"
    ? `${title} (${count} signal${count > 1 ? "s" : ""}).`
    : `${title} (신호 ${count}개).`;

export const aggregateFindings = (opts: AggregateOpts): UXFinding[] => {
  const { signals, events, persona, runId, targetUrl, task } = opts;
  const lang: Lang = opts.lang ?? (persona.sourceProvenance.dataset.includes("USA") ? "en" : "ko");
  const recsByType = recommendationsFor(lang);
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
    const rec = recsByType[type];
    const titleBase = TITLE_BY_TYPE[type];

    const finding: UXFinding = {
      id: newFindingId(idx),
      runId,
      severity,
      title: titleBase,
      summary: summaryFor(lang, titleBase, group.length),
      persona: { id: persona.personaId, displayName: persona.displayName },
      evidence: {
        timestamps,
        eventIds,
        frictionSignalIds: group.map((s) => s.id),
        screenshots: screenshots.length > 0 ? screenshots : undefined,
      },
      diagnosis: {
        userGoal: goalLabel(lang, task),
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
      lang,
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
