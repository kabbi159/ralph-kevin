import { type AgentAction, type RunConfig, type RunEvent, newEventId } from "@personabench/core";
import type { CompactedObservation } from "@personabench/runner";

// Scripted-run event generator. Replays a deterministic price-sensitive
// checkout flow that exercises the example app's intentional defects:
// hidden shipping fee, vague "약 ~원" total, dead click on the disabled
// CTA. The output is a real RunEvent[] that flows through the same
// detectors / aggregator / interview generator / report renderer the
// live agent-browser run would produce.
//
// Logged in .ralph/spec-changes.md (TASK-050) as the time-budget shortcut
// for the demo path; the live flow remains wired in packages/runner.

export type ScriptStepInput = {
  observation: CompactedObservation;
  action: AgentAction;
  thoughtSummary?: string;
  result?: RunEvent["result"];
  // Milliseconds since run start when this step is recorded.
  atMs: number;
};

const checkoutObservation = (
  which: "initial" | "withShipping" | "blockedCTA",
): CompactedObservation => {
  if (which === "initial") {
    return {
      origin: "http://localhost:3100",
      refs: ["e1", "e3", "e5", "e8"],
      visibleText:
        "주문/결제 — 무선 이어폰 Pro — ₩49,000 — 배송 정보 — 쿠폰 코드 — 예상 합계 약 49,000원~ — 결제 확정",
      interactiveElements: [
        { selector: "@e1", role: "heading", label: "주문/결제" },
        { selector: "@e3", role: "button", label: "배송 정보" },
        { selector: "@e5", role: "textbox", label: "쿠폰 코드" },
        { selector: "@e8", role: "button", label: "결제 확정" },
      ],
    };
  }
  if (which === "withShipping") {
    return {
      origin: "http://localhost:3100",
      refs: ["e1", "e3", "e5", "e8"],
      visibleText:
        "주문/결제 — 무선 이어폰 Pro — ₩49,000 — 배송 정보 ▾ — 일반 배송 (3-5일 소요) — 배송비: ₩3,000 — 쿠폰 코드 — 예상 합계 약 52,000원~ — 결제 확정",
      interactiveElements: [
        { selector: "@e1", role: "heading", label: "주문/결제" },
        { selector: "@e3", role: "button", label: "배송 정보" },
        { selector: "@e5", role: "textbox", label: "쿠폰 코드" },
        { selector: "@e8", role: "button", label: "결제 확정" },
      ],
    };
  }
  return {
    origin: "http://localhost:3100",
    refs: ["e1", "e3", "e5", "e8"],
    visibleText: "주문/결제 — 예상 합계 약 52,000원~ — 결제 확정 (비활성화)",
    interactiveElements: [
      { selector: "@e1", role: "heading", label: "주문/결제" },
      { selector: "@e3", role: "button", label: "배송 정보" },
      { selector: "@e5", role: "textbox", label: "쿠폰 코드" },
      { selector: "@e8", role: "button", label: "결제 확정" },
    ],
  };
};

export const buildCheckoutScriptedEvents = (
  runId: string,
  personaId: string,
  startedAtMs: number,
): RunEvent[] => {
  const steps: ScriptStepInput[] = [
    {
      observation: checkoutObservation("initial"),
      action: { type: "scroll", direction: "down", reason: "전체 페이지 훑어보기" },
      thoughtSummary: "총액이 어디 있는지 먼저 확인하고 싶다.",
      atMs: 0,
      result: { domChanged: false, screenshotPath: "artifacts/screenshots/0.png" },
    },
    {
      observation: checkoutObservation("initial"),
      action: { type: "click", selector: "@e3", reason: "배송비 펼쳐 보기" },
      thoughtSummary: "배송비가 토글 안에만 있어서 답답하다.",
      atMs: 4_000,
      result: {
        domChanged: true,
        urlChanged: false,
        screenshotPath: "artifacts/screenshots/1.png",
      },
    },
    {
      observation: checkoutObservation("withShipping"),
      action: {
        type: "wait",
        durationMs: 13_500,
        reason: "총액에 '약 ~원'이 붙어 있어 정확한 금액인지 확인 중",
      },
      thoughtSummary: "이게 진짜 결제될 금액인지 확신이 안 든다.",
      atMs: 7_000,
      result: { domChanged: false },
    },
    {
      observation: checkoutObservation("withShipping"),
      action: { type: "scroll", direction: "down", reason: "환불 정책 링크 찾기" },
      thoughtSummary: "환불 정책이 어디 있는지 모르겠다.",
      atMs: 22_000,
      result: { domChanged: false },
    },
    {
      observation: checkoutObservation("withShipping"),
      action: { type: "scroll", direction: "down", reason: "환불 정책 링크 찾기 (2)" },
      atMs: 25_500,
      result: { domChanged: false },
    },
    {
      observation: checkoutObservation("withShipping"),
      action: { type: "scroll", direction: "down", reason: "환불 정책 링크 찾기 (3)" },
      atMs: 27_000,
      result: { domChanged: false },
    },
    {
      observation: checkoutObservation("blockedCTA"),
      action: { type: "click", selector: "@e8", reason: "결제 확정 버튼 시도" },
      thoughtSummary: "결제 확정을 눌러봐도 반응이 없다.",
      atMs: 32_000,
      result: {
        urlChanged: false,
        domChanged: false,
        screenshotPath: "artifacts/screenshots/6.png",
      },
    },
    {
      observation: checkoutObservation("blockedCTA"),
      action: { type: "click", selector: "@e8", reason: "결제 확정 다시 시도" },
      atMs: 33_500,
      result: { urlChanged: false, domChanged: false },
    },
    {
      observation: checkoutObservation("blockedCTA"),
      action: { type: "click", selector: "@e8", reason: "결제 확정 한 번 더" },
      atMs: 35_000,
      result: { urlChanged: false, domChanged: false },
    },
    {
      observation: checkoutObservation("blockedCTA"),
      action: {
        type: "stop",
        outcome: "dropoff",
        reason: "총액 모호 + 환불 정책 미확인 + 버튼 응답 없음",
      },
      thoughtSummary: "이건 결제 못 하겠다.",
      atMs: 36_000,
    },
  ];

  return steps.map((step, idx) => ({
    id: newEventId(),
    runId,
    personaId,
    timestampMs: startedAtMs + step.atMs,
    stepIndex: idx,
    page: { url: "http://localhost:3100/checkout", title: "주문/결제" },
    observation: step.observation,
    action: step.action,
    result: step.result,
    thoughtSummary: step.thoughtSummary,
  }));
};

// A "post-fix" variant used by the demo's compare flow — represents the same
// persona on the example app *after* the price_uncertainty / dead_click fix
// has been applied. Produces 0 friction signals → all P1 findings move to
// `resolved` in compare.
export const buildCheckoutPostFixEvents = (
  runId: string,
  personaId: string,
  startedAtMs: number,
): RunEvent[] => {
  const obs: CompactedObservation = {
    origin: "http://localhost:3100",
    refs: ["e1", "e3", "e5", "e8"],
    visibleText:
      "주문/결제 — 무선 이어폰 Pro ₩49,000 — 배송비 ₩3,000 — 쿠폰 코드 — 합계 ₩52,000 — 결제 확정",
    interactiveElements: [
      { selector: "@e1", role: "heading", label: "주문/결제" },
      { selector: "@e3", role: "button", label: "배송 정보" },
      { selector: "@e5", role: "textbox", label: "쿠폰 코드" },
      { selector: "@e8", role: "button", label: "결제 확정" },
    ],
  };
  const ev = (idx: number, atMs: number, overrides: Partial<RunEvent>): RunEvent => ({
    id: newEventId(),
    runId,
    personaId,
    timestampMs: startedAtMs + atMs,
    stepIndex: idx,
    page: { url: "http://localhost:3100/checkout", title: "주문/결제" },
    observation: obs,
    ...overrides,
  });

  return [
    ev(0, 0, {
      action: { type: "scroll", direction: "down", reason: "내용 확인" },
      result: { domChanged: false, screenshotPath: "artifacts/screenshots/0.png" },
    }),
    ev(1, 1_500, {
      action: { type: "click", selector: "@e8", reason: "총액이 명확해서 바로 결제" },
      result: {
        domChanged: true,
        urlChanged: false,
        screenshotPath: "artifacts/screenshots/1.png",
      },
      thoughtSummary: "총액이 정확해서 안심하고 진행한다.",
    }),
    ev(2, 2_500, {
      action: { type: "stop", outcome: "success", reason: "결제 확정 직전까지 완료" },
    }),
  ];
};
