import {
  FrictionSignalSchema,
  type PersonaUXProfile,
  type RunEvent,
  UXFindingSchema,
} from "@personabench/core";
import { describe, expect, it } from "vitest";
import { aggregateFindings } from "../findings/aggregate";
import { renderFixPrompt } from "../findings/fix-prompt";
import { runDetectors } from "../friction/detectors";
import { generateInterview } from "../interview/generate";

const persona: PersonaUXProfile = {
  personaId: "mock_p_19",
  displayName: "19세 디자인 전공 학생",
  sourceProvenance: { provider: "mock", dataset: "fixture/checkout-v1" },
  background: "Test bg.",
  uxBehavior: {
    digitalConfidence: "x",
    decisionStyle: "x",
    likelyConcerns: [],
    frictionTriggers: [],
    trustSignals: [],
    completionStyle: "x",
  },
  taskBehaviorInstructions: {
    actNaturally: "x",
    doNotOptimizeForTaskCompletion: "x",
    verbalizeConfusion: "x",
    abandonIfReasonable: "x",
  },
  promptBlock: "Persona prompt.",
};

const checkoutEvents: RunEvent[] = [
  {
    id: "e1",
    runId: "run_g1",
    personaId: persona.personaId,
    timestampMs: 0,
    stepIndex: 0,
    page: { url: "http://localhost:3100/checkout" },
    observation: { visibleText: "주문/결제 무선 이어폰 ₩49,000 예상 합계 약 49,000원~" },
    action: { type: "click", selector: "@e3", reason: "open shipping panel" },
    result: { urlChanged: false, domChanged: true, screenshotPath: "artifacts/screenshots/0.png" },
    thoughtSummary: "배송비 어디 있지",
  },
  {
    id: "e2",
    runId: "run_g1",
    personaId: persona.personaId,
    timestampMs: 12_000,
    stepIndex: 1,
    page: { url: "http://localhost:3100/checkout" },
    observation: { visibleText: "배송비 ₩3,000 예상 합계 약 52,000원~" },
    action: { type: "wait", durationMs: 13_000, reason: "총액이 모호" },
    thoughtSummary: "환불 정책이 뭐지",
  },
  {
    id: "e3",
    runId: "run_g1",
    personaId: persona.personaId,
    timestampMs: 26_000,
    stepIndex: 2,
    page: { url: "http://localhost:3100/checkout" },
    action: { type: "click", selector: "@e8", reason: "결제 확정 시도" },
    result: { urlChanged: false, domChanged: false, screenshotPath: "artifacts/screenshots/2.png" },
  },
  {
    id: "e4",
    runId: "run_g1",
    personaId: persona.personaId,
    timestampMs: 27_000,
    stepIndex: 3,
    page: { url: "http://localhost:3100/checkout" },
    action: { type: "stop", outcome: "dropoff", reason: "총액 모호 + 환불 정책 미확인" },
  },
];

describe("aggregateFindings", () => {
  it("produces ≥1 high finding from the seeded checkout fixture (G1 baseline)", () => {
    const signals = runDetectors(checkoutEvents, { runId: "run_g1", personaId: persona.personaId });
    expect(signals.length).toBeGreaterThanOrEqual(3);
    const findings = aggregateFindings({
      signals,
      events: checkoutEvents,
      persona,
      runId: "run_g1",
      targetUrl: "http://localhost:3100/checkout",
      task: "Reach the payment confirmation without paying for real.",
    });
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.some((f) => f.severity === "critical" || f.severity === "high")).toBe(true);
  });

  it("each finding round-trips through UXFindingSchema", () => {
    const signals = runDetectors(checkoutEvents, { runId: "run_g1", personaId: persona.personaId });
    for (const s of signals) FrictionSignalSchema.parse(s);
    const findings = aggregateFindings({
      signals,
      events: checkoutEvents,
      persona,
      runId: "run_g1",
      targetUrl: "http://localhost:3100/checkout",
      task: "x",
    });
    for (const f of findings) {
      expect(() => UXFindingSchema.parse(f)).not.toThrow();
      expect(f.evidence.eventIds.length).toBeGreaterThanOrEqual(1);
      expect(f.evidence.frictionSignalIds.length).toBeGreaterThanOrEqual(1);
      expect(f.codingAgentPrompt.length).toBeGreaterThan(40);
    }
  });

  it("findings are ordered critical → low and re-ided F-001..F-N", () => {
    const signals = runDetectors(checkoutEvents, { runId: "run_g1", personaId: persona.personaId });
    const findings = aggregateFindings({
      signals,
      events: checkoutEvents,
      persona,
      runId: "run_g1",
      targetUrl: "http://localhost:3100/checkout",
      task: "x",
    });
    expect(findings[0]?.id).toBe("F-001");
    if (findings.length > 1) expect(findings[1]?.id).toBe("F-002");
    const order = ["critical", "high", "medium", "low"] as const;
    let prev = -1;
    for (const f of findings) {
      const idx = order.indexOf(f.severity);
      expect(idx).toBeGreaterThanOrEqual(prev);
      prev = idx;
    }
  });
});

describe("renderFixPrompt", () => {
  it("includes context, evidence, required fix, and acceptance criteria", () => {
    const signals = runDetectors(checkoutEvents, { runId: "run_g1", personaId: persona.personaId });
    const findings = aggregateFindings({
      signals,
      events: checkoutEvents,
      persona,
      runId: "run_g1",
      targetUrl: "http://localhost:3100/checkout",
      task: "Complete checkout",
    });
    const finding = findings[0];
    expect(finding).toBeDefined();
    if (!finding) return;
    const mdEn = renderFixPrompt({
      finding,
      persona,
      targetUrl: "http://localhost:3100/checkout",
      task: "Complete checkout",
      signalTypes: ["price_uncertainty"],
      lang: "en",
    });
    expect(mdEn).toContain("# UX Fix Task:");
    expect(mdEn).toContain("## Evidence");
    expect(mdEn).toContain("## Required fix");
    expect(mdEn).toContain("## Acceptance criteria");
    expect(mdEn).toContain("Rerun PersonaBench");

    const mdKo = renderFixPrompt({
      finding,
      persona,
      targetUrl: "http://localhost:3100/checkout",
      task: "Complete checkout",
      signalTypes: ["price_uncertainty"],
      lang: "ko",
    });
    expect(mdKo).toContain("# UX 수정 작업:");
    expect(mdKo).toContain("## 증거");
    expect(mdKo).toContain("## 필요한 수정");
    expect(mdKo).toContain("## 수용 기준");
    expect(mdKo).toContain("PersonaBench");
  });
});

describe("generateInterview", () => {
  it("returns 3-5 Q&A pairs all grounded in real eventIds", () => {
    const signals = runDetectors(checkoutEvents, { runId: "run_g1", personaId: persona.personaId });
    const interview = generateInterview({
      events: checkoutEvents,
      signals,
      persona,
      runId: "run_g1",
    });
    expect(interview.qaPairs.length).toBeGreaterThanOrEqual(3);
    expect(interview.qaPairs.length).toBeLessThanOrEqual(5);
    const known = new Set(checkoutEvents.map((e) => e.id));
    for (const p of interview.qaPairs) {
      expect(p.eventIds.length).toBeGreaterThanOrEqual(1);
      for (const id of p.eventIds) expect(known.has(id)).toBe(true);
    }
    expect(interview.summary.length).toBeGreaterThan(10);
  });

  it("does not invent issues when there are no friction signals", () => {
    const cleanEvents = checkoutEvents.slice(0, 1);
    const interview = generateInterview({
      events: cleanEvents,
      signals: [],
      persona,
      runId: "run_clean",
    });
    expect(interview.qaPairs.length).toBeGreaterThanOrEqual(3);
    expect(interview.summary.toLowerCase()).toContain("without notable friction");
  });
});
