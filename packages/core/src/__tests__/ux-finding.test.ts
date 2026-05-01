import { describe, expect, it } from "vitest";
import {
  FrictionSignalSchema,
  FrictionSignalTypeSchema,
  InterviewSchema,
  UXFindingSchema,
} from "../schemas";

describe("FrictionSignalSchema", () => {
  it("covers all 11 friction types from the spec", () => {
    const types = FrictionSignalTypeSchema.options;
    expect(types).toEqual([
      "long_hesitation",
      "repeated_click",
      "dead_click",
      "backtrack",
      "form_error",
      "scroll_search",
      "task_abandonment",
      "cta_not_found",
      "copy_confusion",
      "price_uncertainty",
      "trust_uncertainty",
    ]);
    expect(types).toHaveLength(11);
  });

  it("accepts a price_uncertainty signal with required eventId evidence", () => {
    const signal = {
      id: "fs_001",
      runId: "run_test",
      personaId: "nemotron:Nemotron-Personas-Korea:row-12345",
      type: "price_uncertainty" as const,
      severityHint: "high" as const,
      timestampStartMs: 1746077400000,
      timestampEndMs: 1746077412000,
      evidence: {
        eventIds: ["evt_step3", "evt_step4"],
        screenshotPaths: ["artifacts/screenshots/3.png"],
        notes: "페르소나가 '약 ~원' 표기를 보고 정확한 총액을 묻고 있다.",
      },
    };
    expect(() => FrictionSignalSchema.parse(signal)).not.toThrow();
  });

  it("rejects a signal with empty evidence.eventIds", () => {
    const signal = {
      id: "fs_x",
      runId: "run_test",
      personaId: "p1",
      type: "long_hesitation",
      severityHint: "low",
      timestampStartMs: 0,
      evidence: { eventIds: [], notes: "no evidence" },
    };
    const r = FrictionSignalSchema.safeParse(signal);
    expect(r.success).toBe(false);
  });

  it("rejects a signal with an unknown type", () => {
    const r = FrictionSignalSchema.safeParse({
      id: "fs_x",
      runId: "run_test",
      personaId: "p1",
      type: "vibes_misalignment",
      severityHint: "low",
      timestampStartMs: 0,
      evidence: { eventIds: ["evt_x"], notes: "n" },
    });
    expect(r.success).toBe(false);
  });
});

const sampleFinding = {
  id: "F-001",
  runId: "run_test",
  severity: "high" as const,
  title: "최종 결제 금액이 모호함",
  summary:
    "체크아웃 페이지의 '예상 합계 약 ~원' 표기가 정확한 총액을 가리지 못해 페르소나가 결제를 멈춘다.",
  persona: {
    id: "nemotron:Nemotron-Personas-Korea:row-12345",
    displayName: "19세 디자인 전공 학생",
  },
  evidence: {
    timestamps: ["00:23", "00:41"],
    eventIds: ["evt_step3", "evt_step5", "evt_step8"],
    frictionSignalIds: ["fs_001", "fs_004"],
    screenshots: ["artifacts/screenshots/3.png", "artifacts/screenshots/5.png"],
  },
  diagnosis: {
    userGoal: "정확한 결제 총액을 확인하고 안심하고 결제 확정 버튼을 누른다.",
    observedBehavior: "총액 영역에서 12초간 멈췄고, 배송 정보를 펼친 후 다시 총액을 확인했다.",
    likelyCause:
      "총액 표시에 '약 ~원' 접미사가 붙어 정확한 금액으로 보이지 않는다. 배송비가 토글 안에만 노출된다.",
    confidence: 0.82,
  },
  recommendation: {
    uxChange: "총액 영역에서 '약 ~원' 접미사를 제거하고, 배송비를 항상 표시되는 항목으로 옮긴다.",
    implementationHint:
      "examples/ecommerce-checkout/app/checkout/page.tsx 의 totalDisplay 와 배송 토글 영역.",
    acceptanceCriteria: [
      "체크아웃 첫 화면에서 정확한 총액(원 단위)이 즉시 보인다.",
      "배송비는 토글 없이 항목별로 합계 위에 표시된다.",
    ],
  },
  codingAgentPrompt:
    "# UX Fix Task: 최종 결제 금액이 모호함\n\n## Context\n- URL: http://localhost:3100/checkout\n…",
};

describe("UXFindingSchema", () => {
  it("accepts a fully-evidenced finding", () => {
    const parsed = UXFindingSchema.parse(sampleFinding);
    expect(parsed.id).toBe("F-001");
    expect(parsed.diagnosis.confidence).toBe(0.82);
  });

  it("rejects confidence outside [0, 1]", () => {
    const bad = {
      ...sampleFinding,
      diagnosis: { ...sampleFinding.diagnosis, confidence: 1.5 },
    };
    const r = UXFindingSchema.safeParse(bad);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(["diagnosis", "confidence"]);
    }
  });

  it("rejects a finding with no evidence eventIds (must cite behavior)", () => {
    const bad = {
      ...sampleFinding,
      evidence: { ...sampleFinding.evidence, eventIds: [] },
    };
    const r = UXFindingSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("rejects a finding with no friction signal ids (must aggregate)", () => {
    const bad = {
      ...sampleFinding,
      evidence: { ...sampleFinding.evidence, frictionSignalIds: [] },
    };
    const r = UXFindingSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("rejects a finding with empty acceptance criteria", () => {
    const bad = {
      ...sampleFinding,
      recommendation: { ...sampleFinding.recommendation, acceptanceCriteria: [] },
    };
    const r = UXFindingSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("rejects an empty codingAgentPrompt", () => {
    const bad = { ...sampleFinding, codingAgentPrompt: "" };
    const r = UXFindingSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });
});

describe("InterviewSchema", () => {
  const baseQA = (i: number) => ({
    question: `Q${i}: 어디서 가장 머뭇거렸나요?`,
    answer: `A${i}: 총액 영역에서 멈칫했습니다.`,
    eventIds: [`evt_step${i}`],
  });

  it("accepts a 3-pair interview", () => {
    const interview = {
      id: "iv_001",
      runId: "run_test",
      personaId: "nemotron:Nemotron-Personas-Korea:row-12345",
      qaPairs: [baseQA(1), baseQA(2), baseQA(3)],
      summary: "총액 표기와 배송비 위치가 결제 진행을 방해했다.",
      createdAt: "2026-05-01T13:55:00+09:00",
    };
    expect(() => InterviewSchema.parse(interview)).not.toThrow();
  });

  it("accepts a 5-pair interview (the upper bound)", () => {
    const interview = {
      id: "iv_002",
      runId: "run_test",
      personaId: "p1",
      qaPairs: [baseQA(1), baseQA(2), baseQA(3), baseQA(4), baseQA(5)],
      summary: "x",
      createdAt: "2026-05-01T13:55:00+09:00",
    };
    expect(() => InterviewSchema.parse(interview)).not.toThrow();
  });

  it("rejects fewer than 3 Q&A pairs", () => {
    const interview = {
      id: "iv_x",
      runId: "run_test",
      personaId: "p1",
      qaPairs: [baseQA(1), baseQA(2)],
      summary: "x",
      createdAt: "2026-05-01T13:55:00+09:00",
    };
    expect(InterviewSchema.safeParse(interview).success).toBe(false);
  });

  it("rejects more than 5 Q&A pairs", () => {
    const interview = {
      id: "iv_x",
      runId: "run_test",
      personaId: "p1",
      qaPairs: [baseQA(1), baseQA(2), baseQA(3), baseQA(4), baseQA(5), baseQA(6)],
      summary: "x",
      createdAt: "2026-05-01T13:55:00+09:00",
    };
    expect(InterviewSchema.safeParse(interview).success).toBe(false);
  });

  it("rejects a Q&A pair with no eventIds (interview must be grounded)", () => {
    const interview = {
      id: "iv_x",
      runId: "run_test",
      personaId: "p1",
      qaPairs: [{ question: "q", answer: "a", eventIds: [] }, baseQA(2), baseQA(3)],
      summary: "x",
      createdAt: "2026-05-01T13:55:00+09:00",
    };
    expect(InterviewSchema.safeParse(interview).success).toBe(false);
  });
});
