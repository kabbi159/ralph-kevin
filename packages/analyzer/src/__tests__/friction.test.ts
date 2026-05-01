import type { RunEvent } from "@personabench/core";
import { describe, expect, it } from "vitest";
import {
  detectBacktrack,
  detectCtaNotFound,
  detectDeadClick,
  detectLongHesitation,
  detectPriceUncertainty,
  detectRepeatedClick,
  detectScrollSearch,
  detectTaskAbandonment,
  detectTrustUncertainty,
  runDetectors,
} from "../friction/detectors";

const ev = (
  overrides: Partial<RunEvent> & { stepIndex: number; timestampMs: number; id: string },
): RunEvent => ({
  runId: "run_t",
  personaId: "p1",
  page: { url: "http://localhost:3100/checkout" },
  ...overrides,
});

describe("friction detectors", () => {
  it("detectLongHesitation fires on a wait action ≥10s", () => {
    const events: RunEvent[] = [
      ev({
        id: "e1",
        stepIndex: 0,
        timestampMs: 0,
        action: { type: "wait", durationMs: 12_000, reason: "stuck" },
      }),
    ];
    const sigs = detectLongHesitation({ events, runId: "run_t", personaId: "p1" });
    expect(sigs).toHaveLength(1);
    expect(sigs[0]?.type).toBe("long_hesitation");
  });

  it("detectLongHesitation fires on a 20s+ inter-event gap", () => {
    const events: RunEvent[] = [
      ev({ id: "e1", stepIndex: 0, timestampMs: 0, action: { type: "click", reason: "x" } }),
      ev({ id: "e2", stepIndex: 1, timestampMs: 25_000, action: { type: "click", reason: "y" } }),
    ];
    const sigs = detectLongHesitation({ events, runId: "run_t", personaId: "p1" });
    expect(sigs.length).toBeGreaterThanOrEqual(1);
    expect(sigs[0]?.severityHint).toBe("medium");
  });

  it("detectRepeatedClick fires on 3 same-selector clicks within 10s", () => {
    const events: RunEvent[] = [
      ev({
        id: "e1",
        stepIndex: 0,
        timestampMs: 0,
        action: { type: "click", selector: "@e8", reason: "1" },
      }),
      ev({
        id: "e2",
        stepIndex: 1,
        timestampMs: 2_000,
        action: { type: "click", selector: "@e8", reason: "2" },
      }),
      ev({
        id: "e3",
        stepIndex: 2,
        timestampMs: 6_000,
        action: { type: "click", selector: "@e8", reason: "3" },
      }),
    ];
    const sigs = detectRepeatedClick({ events, runId: "run_t", personaId: "p1" });
    expect(sigs).toHaveLength(1);
    expect(sigs[0]?.evidence.eventIds).toHaveLength(3);
  });

  it("detectDeadClick fires when result has urlChanged=false AND domChanged=false", () => {
    const events: RunEvent[] = [
      ev({
        id: "e1",
        stepIndex: 0,
        timestampMs: 0,
        action: { type: "click", selector: "@e8", reason: "x" },
        result: { urlChanged: false, domChanged: false },
      }),
    ];
    const sigs = detectDeadClick({ events, runId: "run_t", personaId: "p1" });
    expect(sigs).toHaveLength(1);
  });

  it("detectBacktrack fires on a back action", () => {
    const events: RunEvent[] = [
      ev({ id: "e1", stepIndex: 0, timestampMs: 0, action: { type: "back", reason: "retreat" } }),
    ];
    const sigs = detectBacktrack({ events, runId: "run_t", personaId: "p1" });
    expect(sigs).toHaveLength(1);
  });

  it("detectCtaNotFound fires when stop:dropoff and no '결제'/'pay' click was made", () => {
    const events: RunEvent[] = [
      ev({
        id: "e1",
        stepIndex: 0,
        timestampMs: 0,
        action: { type: "scroll", direction: "down", reason: "look" },
      }),
      ev({
        id: "e2",
        stepIndex: 1,
        timestampMs: 5_000,
        action: { type: "stop", outcome: "dropoff", reason: "no CTA" },
      }),
    ];
    const sigs = detectCtaNotFound({ events, runId: "run_t", personaId: "p1" });
    expect(sigs).toHaveLength(1);
    expect(sigs[0]?.severityHint).toBe("high");
  });

  it("detectScrollSearch fires after 3 consecutive scrolls", () => {
    const events: RunEvent[] = [
      ev({
        id: "e1",
        stepIndex: 0,
        timestampMs: 0,
        action: { type: "scroll", direction: "down", reason: "1" },
      }),
      ev({
        id: "e2",
        stepIndex: 1,
        timestampMs: 1_000,
        action: { type: "scroll", direction: "down", reason: "2" },
      }),
      ev({
        id: "e3",
        stepIndex: 2,
        timestampMs: 2_000,
        action: { type: "scroll", direction: "down", reason: "3" },
      }),
      ev({
        id: "e4",
        stepIndex: 3,
        timestampMs: 3_000,
        action: { type: "click", selector: "@e1", reason: "found" },
      }),
    ];
    const sigs = detectScrollSearch({ events, runId: "run_t", personaId: "p1" });
    expect(sigs).toHaveLength(1);
  });

  it("detectPriceUncertainty fires when visibleText has both '약' and '~원'", () => {
    const events: RunEvent[] = [
      ev({
        id: "e1",
        stepIndex: 0,
        timestampMs: 0,
        observation: { visibleText: "예상 합계 약 49,000원~ 결제 확정" },
      }),
    ];
    const sigs = detectPriceUncertainty({ events, runId: "run_t", personaId: "p1" });
    expect(sigs).toHaveLength(1);
    expect(sigs[0]?.severityHint).toBe("high");
  });

  it("detectTrustUncertainty fires on a thoughtSummary that mentions '환불'", () => {
    const events: RunEvent[] = [
      ev({
        id: "e1",
        stepIndex: 0,
        timestampMs: 0,
        thoughtSummary: "환불 정책이 어디 있는지 모르겠어.",
      }),
    ];
    const sigs = detectTrustUncertainty({ events, runId: "run_t", personaId: "p1" });
    expect(sigs).toHaveLength(1);
  });

  it("detectTaskAbandonment fires on stop:dropoff/blocked/timeout", () => {
    const events: RunEvent[] = [
      ev({
        id: "e1",
        stepIndex: 0,
        timestampMs: 0,
        action: { type: "stop", outcome: "dropoff", reason: "give up" },
      }),
    ];
    const sigs = detectTaskAbandonment({ events, runId: "run_t", personaId: "p1" });
    expect(sigs).toHaveLength(1);
  });

  it("runDetectors composes all heuristics and returns at least 3 signals on the seeded checkout fixture (G1 baseline)", () => {
    // Compose a fixture that mirrors the example checkout flow's intentional defects.
    const events: RunEvent[] = [
      ev({
        id: "e1",
        stepIndex: 0,
        timestampMs: 0,
        observation: { visibleText: "주문/결제 무선 이어폰 Pro ₩49,000 예상 합계 약 49,000원~" },
        action: { type: "click", selector: "@e3", reason: "open shipping panel" },
        result: { urlChanged: false, domChanged: true },
        thoughtSummary: "배송비를 먼저 확인하고 싶다.",
      }),
      ev({
        id: "e2",
        stepIndex: 1,
        timestampMs: 12_000,
        observation: { visibleText: "배송비 ₩3,000 예상 합계 약 52,000원~" },
        action: { type: "wait", durationMs: 12_500, reason: "정확한 총액이 안 보여서" },
      }),
      ev({
        id: "e3",
        stepIndex: 2,
        timestampMs: 25_000,
        observation: { visibleText: "결제 확정" },
        action: { type: "click", selector: "@e8", reason: "결제 확정 시도" },
        result: { urlChanged: false, domChanged: false },
        thoughtSummary: "환불 정책 확인하고 싶다.",
      }),
      ev({
        id: "e4",
        stepIndex: 3,
        timestampMs: 26_000,
        action: { type: "stop", outcome: "dropoff", reason: "총액이 모호해서 멈춤" },
      }),
    ];
    const signals = runDetectors(events, { runId: "run_g1", personaId: "p_g1" });
    const types = new Set(signals.map((s) => s.type));
    expect(signals.length).toBeGreaterThanOrEqual(3);
    expect(types.has("price_uncertainty")).toBe(true);
    expect(types.has("long_hesitation")).toBe(true);
    expect(types.has("dead_click")).toBe(true);
    expect(types.has("trust_uncertainty")).toBe(true);
    expect(types.has("task_abandonment")).toBe(true);
  });
});
