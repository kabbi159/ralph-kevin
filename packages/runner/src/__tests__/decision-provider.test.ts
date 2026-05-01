import { describe, expect, it } from "vitest";
import { ClaudeDecisionProvider, DEFAULT_DECISION_MODEL } from "../decide/claude-decision-provider";
import type { DecisionInput } from "../decide/decision-provider";
import { MockDecisionProvider } from "../decide/mock-decision-provider";

const makeInput = (): DecisionInput => ({
  observation: {
    origin: "http://localhost:3100",
    refs: ["e1", "e3", "e8"],
    visibleText: "주문/결제 — ₩49,000 — 예상 합계 약 49,000원~ — 결제 확정",
    interactiveElements: [
      { selector: "@e1", role: "heading", label: "주문/결제" },
      { selector: "@e3", role: "button", label: "배송 정보" },
      { selector: "@e8", role: "button", label: "결제 확정" },
    ],
  },
  persona: {
    personaId: "mock_kr_42",
    displayName: "Test persona",
    sourceProvenance: { provider: "mock", dataset: "fixture/test" },
    background: "Test background.",
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
    promptBlock: "Persona instructions here.",
  },
  task: "Reach the payment confirmation button without paying for real.",
  successCriteria: ["See the final total clearly"],
  recentHistory: [],
  budget: { actionsRemaining: 30, secondsRemaining: 180 },
});

describe("MockDecisionProvider", () => {
  it("returns each AgentAction in order, then a stop:dropoff when exhausted", async () => {
    const provider = new MockDecisionProvider([
      { type: "click", selector: "@e3", reason: "open shipping panel" },
      { type: "scroll", direction: "down", reason: "look for total" },
    ]);
    const input = makeInput();
    const a1 = await provider.decide(input);
    const a2 = await provider.decide(input);
    const a3 = await provider.decide(input);
    expect(a1).toEqual({ type: "click", selector: "@e3", reason: "open shipping panel" });
    expect(a2).toEqual({ type: "scroll", direction: "down", reason: "look for total" });
    expect(a3.type).toBe("stop");
    if (a3.type === "stop") expect(a3.outcome).toBe("dropoff");
  });

  it("validates each plan entry against AgentActionSchema at construction", () => {
    expect(
      () =>
        new MockDecisionProvider([
          // missing reason — invalid
          { type: "click" } as never,
        ]),
    ).toThrow();
  });

  it("reset() rewinds the cursor to the start of the plan", async () => {
    const provider = new MockDecisionProvider([{ type: "back", reason: "retry" }]);
    await provider.decide(makeInput());
    provider.reset();
    const again = await provider.decide(makeInput());
    expect(again.type).toBe("back");
  });
});

describe("ClaudeDecisionProvider", () => {
  it("uses claude-haiku-4-5-20251001 by default", async () => {
    const captured: Array<{ model: string; system: string; user: string }> = [];
    const provider = new ClaudeDecisionProvider({
      chatFn: async (req) => {
        captured.push({
          model: req.model,
          system: req.system,
          user: req.messages[0]?.content ?? "",
        });
        return JSON.stringify({
          type: "click",
          selector: "@e3",
          reason: "open shipping",
        });
      },
    });
    await provider.decide(makeInput());
    expect(captured[0]?.model).toBe(DEFAULT_DECISION_MODEL);
  });

  it("includes the persona promptBlock in the system message", async () => {
    let capturedSystem = "";
    const provider = new ClaudeDecisionProvider({
      chatFn: async (req) => {
        capturedSystem = req.system;
        return JSON.stringify({
          type: "stop",
          outcome: "dropoff",
          reason: "test",
        });
      },
    });
    await provider.decide(makeInput());
    expect(capturedSystem).toContain("Persona instructions here.");
    expect(capturedSystem).toContain("AgentAction");
  });

  it("parses model output as a Zod-validated AgentAction", async () => {
    const provider = new ClaudeDecisionProvider({
      chatFn: async () =>
        JSON.stringify({ type: "scroll", direction: "down", reason: "look for total" }),
    });
    const result = await provider.decide(makeInput());
    expect(result.type).toBe("scroll");
    if (result.type === "scroll") expect(result.direction).toBe("down");
  });

  it("strips ```json fences if the model wraps its output", async () => {
    const provider = new ClaudeDecisionProvider({
      chatFn: async () => '```json\n{"type":"back","reason":"retry"}\n```',
    });
    const result = await provider.decide(makeInput());
    expect(result.type).toBe("back");
  });

  it("throws when the model output is not parseable JSON", async () => {
    const provider = new ClaudeDecisionProvider({
      chatFn: async () => "I think we should click the button.",
    });
    await expect(provider.decide(makeInput())).rejects.toThrow();
  });

  it("throws when the model output is parseable but not an AgentAction", async () => {
    const provider = new ClaudeDecisionProvider({
      chatFn: async () => JSON.stringify({ type: "teleport", reason: "no" }),
    });
    await expect(provider.decide(makeInput())).rejects.toThrow();
  });

  it("throws when no API key and no chatFn is supplied", () => {
    const prevKey = process.env.ANTHROPIC_API_KEY;
    // Assigning empty string (not delete) keeps biome happy; the provider's
    // `if (!apiKey)` check treats "" as missing.
    process.env.ANTHROPIC_API_KEY = "";
    try {
      expect(() => new ClaudeDecisionProvider()).toThrow(/ANTHROPIC_API_KEY/);
    } finally {
      if (prevKey !== undefined) process.env.ANTHROPIC_API_KEY = prevKey;
    }
  });
});
