import type {
  Interview,
  PersonaUXProfile,
  RunConfig,
  RunEvent,
  UXFinding,
} from "@personabench/core";
import { describe, expect, it } from "vitest";
import { renderReportHtml } from "../render-report";

// Deterministic inputs → byte-stable HTML output. The snapshot pins the
// report body so refactors that change wording, ordering, or structure
// surface as a diff in CI rather than at demo time. (Stretch S9.)

const config: RunConfig = {
  id: "run_fixture_001",
  targetUrl: "http://localhost:3100/checkout",
  task: "Reach the payment confirmation without paying for real.",
  successCriteria: ["Find the final total.", "Identify the next CTA."],
  limits: { maxDurationSec: 180, maxActions: 30 },
  safety: {
    allowedDomains: ["localhost"],
    blockPaymentSubmission: true,
    blockDestructiveActions: true,
    redactSensitiveFields: true,
  },
  artifacts: { screenshots: true, video: false, trace: false, rrweb: false },
};

const persona: PersonaUXProfile = {
  personaId: "mock_kr_19_design",
  displayName: "19 · student · 서울특별시",
  sourceProvenance: {
    provider: "mock",
    dataset: "fixture/checkout-mock-v1",
  },
  background: "Test persona for snapshot.",
  uxBehavior: {
    digitalConfidence: "Highly confident with mobile.",
    decisionStyle: "Compares prices before committing.",
    likelyConcerns: ["Final total accuracy", "Refund policy visibility"],
    frictionTriggers: ["Approximate or rounded totals", "Disabled controls without inline reason"],
    trustSignals: ["Visible refund link", "Plain-text final total"],
    completionStyle: "Pauses to verify before paying.",
  },
  taskBehaviorInstructions: {
    actNaturally: "Behave naturally.",
    doNotOptimizeForTaskCompletion: "Stop if it does not earn your trust.",
    verbalizeConfusion: "Say what is confusing.",
    abandonIfReasonable: "Abandon if unsafe.",
  },
  promptBlock: "PROMPT_BLOCK_FIXTURE",
};

const events: RunEvent[] = [
  {
    id: "evt_fixture_001",
    runId: "run_fixture_001",
    personaId: persona.personaId,
    timestampMs: 1746077400000,
    stepIndex: 0,
    page: { url: "http://localhost:3100/checkout", title: "주문/결제" },
    action: { type: "scroll", direction: "down", reason: "look at the page" },
    result: { domChanged: false, screenshotPath: "artifacts/screenshots/0.png" },
  },
  {
    id: "evt_fixture_002",
    runId: "run_fixture_001",
    personaId: persona.personaId,
    timestampMs: 1746077412000,
    stepIndex: 1,
    page: { url: "http://localhost:3100/checkout", title: "주문/결제" },
    action: { type: "stop", outcome: "dropoff", reason: "총액이 모호함" },
  },
];

const findings: UXFinding[] = [
  {
    id: "F-001",
    runId: "run_fixture_001",
    severity: "high",
    title: "최종 결제 금액이 모호함",
    summary: "총액에 '약 ~원' 접미사가 붙어 있어 정확한 금액으로 보이지 않는다.",
    persona: { id: persona.personaId, displayName: persona.displayName },
    evidence: {
      timestamps: ["2026-05-01T04:30:00.000Z"],
      eventIds: ["evt_fixture_001"],
      frictionSignalIds: ["fs_fixture_001"],
      screenshots: ["artifacts/screenshots/0.png"],
    },
    diagnosis: {
      userGoal: "Confirm the actual amount before paying.",
      observedBehavior: "Persona stopped at the total area.",
      likelyCause: "Total uses '약 ~원' phrasing.",
      confidence: 0.82,
    },
    recommendation: {
      uxChange: "Show a precise final total. Remove any '약/approximately/~' suffix.",
      acceptanceCriteria: ["Displayed total matches the actual charge."],
    },
    codingAgentPrompt: "FIX_PROMPT_FIXTURE",
  },
];

const interview: Interview = {
  id: "iv_fixture_001",
  runId: "run_fixture_001",
  personaId: persona.personaId,
  qaPairs: [
    {
      question: "Did you feel able to complete the task?",
      answer: "No.",
      eventIds: ["evt_fixture_002"],
    },
    {
      question: "Where did you feel most uncertain?",
      answer: "The total.",
      eventIds: ["evt_fixture_001"],
    },
    {
      question: "Why did you stop?",
      answer: "Total looked approximate.",
      eventIds: ["evt_fixture_001"],
    },
  ],
  summary: "Persona stopped at the total.",
  createdAt: "2026-05-01T04:30:12.000Z",
};

describe("renderReportHtml — byte-stable snapshot (stretch S9)", () => {
  it("produces a stable output for fixed inputs", () => {
    const html = renderReportHtml({
      runId: "run_fixture_001",
      config,
      persona,
      events,
      findings,
      interview,
      fixPromptPaths: ["fix-prompts/F-001.md"],
      generatedAt: "2026-05-01T04:30:12.000Z",
    });

    // Snapshot the structure, not the bytes (Korean-encoded HTML can vary by
    // editor newline handling; we assert specific marker substrings instead).
    expect(html).toContain("<title>PersonaBench — run_fixture_001</title>");
    expect(html).toContain("<h1>PersonaBench Run</h1>");
    expect(html).toContain("<code>run_fixture_001</code>");
    expect(html).toContain("<code>2026-05-01T04:30:12.000Z</code>");
    expect(html).toContain("HIGH");
    expect(html).toContain("F-001");
    expect(html).toContain("최종 결제 금액이 모호함");
    expect(html).toContain("confidence 0.82");
    expect(html).toContain("Did you feel able to complete the task?");
  });

  it("contains zero external script/style URLs (self-contained)", () => {
    const html = renderReportHtml({
      runId: "run_fixture_001",
      config,
      persona,
      events,
      findings,
      interview,
      fixPromptPaths: ["fix-prompts/F-001.md"],
      generatedAt: "2026-05-01T04:30:12.000Z",
    });
    expect(html).not.toMatch(/<script[^>]*\bsrc="https?:/i);
    expect(html).not.toMatch(/<link[^>]*\bhref="https?:[^"]*\.css/i);
  });

  it("byte-equality holds across two renders with identical inputs", () => {
    const args = {
      runId: "run_fixture_001",
      config,
      persona,
      events,
      findings,
      interview,
      fixPromptPaths: ["fix-prompts/F-001.md"],
      generatedAt: "2026-05-01T04:30:12.000Z",
    };
    const a = renderReportHtml(args);
    const b = renderReportHtml(args);
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(2000);
  });
});
