import type { PersonaRecord, RunEvent } from "@personabench/core";
import { newEventId } from "@personabench/core";

// Persona-conditioned scripted event generation. The base scripted run
// captures a price-sensitive shopper; this module varies the depth of the
// flow per persona's derivedTraits so a multi-persona demo run shows
// different friction patterns surfacing on different personas. (Stretch S2.)

type Variant = "deep_price" | "fast_dropout" | "trust_centric" | "completes" | "default";

const variantFor = (record: PersonaRecord): Variant => {
  const t = record.derivedTraits ?? {};
  const price = t.priceSensitivity ?? 3;
  const patience = t.patience ?? 3;
  const trust = t.trustSensitivity ?? 3;
  const literacy = t.digitalLiteracy ?? 3;

  // Low patience + low literacy → drops out early on the first ambiguity.
  if (patience <= 2 && literacy <= 3) return "fast_dropout";
  // High trust sensitivity → spends time looking for the refund policy.
  if (trust >= 4) return "trust_centric";
  // High price sensitivity → deep price-uncertainty exploration.
  if (price >= 4) return "deep_price";
  // High patience + high literacy → reads carefully and completes.
  if (patience >= 4 && literacy >= 4) return "completes";
  return "default";
};

const baseObs = (which: "initial" | "withShipping" | "blockedCTA") => {
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
        "주문/결제 — 무선 이어폰 Pro — ₩49,000 — 배송비: ₩3,000 — 쿠폰 코드 — 예상 합계 약 52,000원~ — 결제 확정",
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

// Each variant emits its own "step list" — atMs is relative to start.
type Step = {
  kind: "initial" | "withShipping" | "blockedCTA";
  atMs: number;
  action: RunEvent["action"];
  thoughtSummary?: string;
  result?: RunEvent["result"];
};

const stepsByVariant: Record<Variant, Step[]> = {
  fast_dropout: [
    {
      kind: "initial",
      atMs: 0,
      action: { type: "scroll", direction: "down", reason: "그냥 훑어보기" },
      result: { domChanged: false, screenshotPath: "artifacts/screenshots/0.png" },
    },
    {
      kind: "initial",
      atMs: 18_000,
      action: { type: "stop", outcome: "dropoff", reason: "복잡해 보여서 그냥 나갈래" },
      thoughtSummary: "이게 뭐가 뭔지 모르겠다.",
    },
  ],
  trust_centric: [
    {
      kind: "initial",
      atMs: 0,
      action: { type: "scroll", direction: "down", reason: "환불 정책 먼저 보고 싶다" },
      result: { domChanged: false, screenshotPath: "artifacts/screenshots/0.png" },
    },
    {
      kind: "initial",
      atMs: 4_500,
      action: { type: "scroll", direction: "down", reason: "환불 정책 링크 찾기 (2)" },
      thoughtSummary: "환불 정책이 어디 있는지 모르겠다.",
    },
    {
      kind: "initial",
      atMs: 6_500,
      action: { type: "scroll", direction: "down", reason: "환불 정책 링크 찾기 (3)" },
      thoughtSummary: "환불 정책이 안 보인다.",
    },
    {
      kind: "initial",
      atMs: 8_500,
      action: { type: "stop", outcome: "dropoff", reason: "환불 정책이 없어서 신뢰 안 됨" },
      thoughtSummary: "정책 없이는 결제 못 해.",
    },
  ],
  deep_price: [
    {
      kind: "initial",
      atMs: 0,
      action: { type: "click", selector: "@e3", reason: "배송비 펼쳐 보기" },
      thoughtSummary: "배송비가 어디 있나",
      result: {
        domChanged: true,
        urlChanged: false,
        screenshotPath: "artifacts/screenshots/0.png",
      },
    },
    {
      kind: "withShipping",
      atMs: 4_000,
      action: {
        type: "wait",
        durationMs: 14_000,
        reason: "총액에 '약 ~원'이 붙어 있어 정확한 금액 확인 중",
      },
      thoughtSummary: "이게 진짜 결제될 금액인가?",
      result: { domChanged: false },
    },
    {
      kind: "withShipping",
      atMs: 19_000,
      action: { type: "click", selector: "@e8", reason: "결제 확정 시도" },
      result: {
        urlChanged: false,
        domChanged: false,
        screenshotPath: "artifacts/screenshots/2.png",
      },
    },
    {
      kind: "blockedCTA",
      atMs: 20_500,
      action: { type: "click", selector: "@e8", reason: "다시 시도" },
      result: { urlChanged: false, domChanged: false },
    },
    {
      kind: "blockedCTA",
      atMs: 22_000,
      action: { type: "click", selector: "@e8", reason: "또 시도" },
      result: { urlChanged: false, domChanged: false },
    },
    {
      kind: "blockedCTA",
      atMs: 24_000,
      action: { type: "stop", outcome: "dropoff", reason: "총액 모호 + 버튼 안 눌림" },
      thoughtSummary: "이건 결제 못 한다.",
    },
  ],
  completes: [
    {
      kind: "initial",
      atMs: 0,
      action: { type: "click", selector: "@e3", reason: "배송 정보 펼치기" },
      result: {
        domChanged: true,
        urlChanged: false,
        screenshotPath: "artifacts/screenshots/0.png",
      },
    },
    {
      kind: "withShipping",
      atMs: 1_500,
      action: { type: "scroll", direction: "down", reason: "약관 확인" },
      result: { domChanged: false },
    },
    {
      kind: "withShipping",
      atMs: 2_500,
      action: { type: "stop", outcome: "success", reason: "총액과 약관 확인 완료, 결제 가능" },
    },
  ],
  default: [
    {
      kind: "initial",
      atMs: 0,
      action: { type: "scroll", direction: "down", reason: "둘러보기" },
      result: { domChanged: false, screenshotPath: "artifacts/screenshots/0.png" },
    },
    {
      kind: "withShipping",
      atMs: 5_000,
      action: { type: "click", selector: "@e8", reason: "결제 시도" },
      result: {
        urlChanged: false,
        domChanged: false,
        screenshotPath: "artifacts/screenshots/1.png",
      },
    },
    {
      kind: "blockedCTA",
      atMs: 6_000,
      action: { type: "stop", outcome: "dropoff", reason: "버튼이 응답하지 않음" },
    },
  ],
};

export const buildPersonaConditionedEvents = (
  record: PersonaRecord,
  runId: string,
  startedAtMs: number,
): RunEvent[] => {
  const variant = variantFor(record);
  const steps = stepsByVariant[variant];
  return steps.map((step, idx) => ({
    id: newEventId(),
    runId,
    personaId: record.id,
    timestampMs: startedAtMs + step.atMs,
    stepIndex: idx,
    page: { url: "http://localhost:3100/checkout", title: "주문/결제" },
    observation: baseObs(step.kind),
    action: step.action,
    result: step.result,
    thoughtSummary: step.thoughtSummary,
  }));
};

export const variantOf = variantFor;
