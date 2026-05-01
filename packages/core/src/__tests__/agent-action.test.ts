import { describe, expect, it } from "vitest";
import { type AgentAction, AgentActionSchema, PersonaUXProfileSchema } from "../schemas";

describe("AgentActionSchema", () => {
  it("accepts each variant of the discriminated union", () => {
    const cases: AgentAction[] = [
      { type: "click", selector: "@e3", reason: "open shipping detail panel" },
      {
        type: "type",
        selector: "@coupon",
        text: "WELCOME10",
        reason: "try the discount",
      },
      { type: "scroll", direction: "down", reason: "look for the total" },
      { type: "wait", durationMs: 4000, reason: "let the page render" },
      { type: "back", reason: "checkout looks risky, retreat to cart" },
      { type: "stop", outcome: "dropoff", reason: "I cannot find the final amount" },
    ];
    for (const c of cases) {
      const parsed = AgentActionSchema.parse(c);
      expect(parsed.type).toBe(c.type);
    }
  });

  it("rejects an unknown type with a descriptive Zod error", () => {
    const result = AgentActionSchema.safeParse({ type: "teleport", reason: "no" });
    expect(result.success).toBe(false);
  });

  it("requires `reason` on every variant", () => {
    const click = AgentActionSchema.safeParse({ type: "click" });
    expect(click.success).toBe(false);
    const wait = AgentActionSchema.safeParse({ type: "wait", durationMs: 1 });
    expect(wait.success).toBe(false);
  });

  it("rejects unknown stop outcomes", () => {
    const r = AgentActionSchema.safeParse({
      type: "stop",
      outcome: "victory",
      reason: "won the game",
    });
    expect(r.success).toBe(false);
  });

  it("rejects negative wait duration", () => {
    const r = AgentActionSchema.safeParse({
      type: "wait",
      durationMs: -100,
      reason: "negative time travel",
    });
    expect(r.success).toBe(false);
  });

  it("accepts click without a selector when x/y coordinates are provided", () => {
    const r = AgentActionSchema.parse({
      type: "click",
      x: 120,
      y: 300,
      reason: "tap on screen-only button",
    });
    expect(r.type).toBe("click");
  });
});

describe("PersonaUXProfileSchema", () => {
  it("round-trips a compiled UX profile through JSON", () => {
    const profile = {
      personaId: "nemotron:Nemotron-Personas-Korea:row-12345",
      displayName: "19세 디자인 전공 학생",
      sourceProvenance: {
        provider: "nvidia" as const,
        dataset: "nvidia/Nemotron-Personas-Korea",
        rowId: "row-12345",
        license: "CC-BY-4.0",
      },
      background: "서울 강남구 거주 19세 여성, 디자인 전공 1학년.",
      uxBehavior: {
        digitalConfidence: "모바일에 익숙함, 데스크탑은 보통",
        decisionStyle: "비교 후 결정 — 가격·후기에 민감",
        likelyConcerns: ["배송비가 어디 있는지", "총액이 정확한지", "환불 가능 여부"],
        frictionTriggers: ["숨겨진 비용", "비활성화된 버튼의 이유 미표시"],
        trustSignals: ["명확한 가격 표시", "환불 정책 링크"],
        completionStyle: "확신이 없으면 멈추고 다른 탭에서 확인",
      },
      taskBehaviorInstructions: {
        actNaturally: "테스트를 통과하려 하지 말고 자연스럽게 행동하라.",
        doNotOptimizeForTaskCompletion: "쉽지 않으면 포기해도 된다.",
        verbalizeConfusion: "혼란스러우면 그 이유를 짧게 말해라.",
        abandonIfReasonable: "신뢰가 안 되면 결제하지 말고 멈춰라.",
      },
      promptBlock: "You are not trying to pass the test. You are 19, a design student in Seoul, …",
    };
    const parsed = PersonaUXProfileSchema.parse(profile);
    const reparsed = PersonaUXProfileSchema.parse(JSON.parse(JSON.stringify(parsed)));
    expect(reparsed).toEqual(parsed);
  });

  it("rejects an empty promptBlock with a descriptive error path", () => {
    const result = PersonaUXProfileSchema.safeParse({
      personaId: "x",
      displayName: "x",
      sourceProvenance: { provider: "mock", dataset: "fixture/mock" },
      background: "x",
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
      promptBlock: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["promptBlock"]);
    }
  });
});
