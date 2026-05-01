import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ArtifactSchema, RunConfigSchema, RunEventSchema, RunSchema } from "../schemas";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..", "..");

const loadJson = (relPath: string) => JSON.parse(readFileSync(resolve(repoRoot, relPath), "utf8"));

describe("RunConfigSchema", () => {
  it("validates examples/run-config.checkout.json", () => {
    const cfg = loadJson("examples/run-config.checkout.json");
    const parsed = RunConfigSchema.parse(cfg);
    expect(parsed.targetUrl).toBe("http://localhost:3100/checkout");
    expect(parsed.safety.allowedDomains).toContain("localhost");
    expect(parsed.safety.blockPaymentSubmission).toBe(true);
    expect(parsed.personaQuery?.demographics?.ageMin).toBe(40);
  });

  it("validates examples/run-config.crack.json (live-site demo)", () => {
    const cfg = loadJson("examples/run-config.crack.json");
    const parsed = RunConfigSchema.parse(cfg);
    expect(parsed.targetUrl).toBe("https://crack.wrtn.ai/");
    expect(parsed.safety.allowedDomains).toEqual(["crack.wrtn.ai", "wrtn.ai"]);
    expect(parsed.personaQuery?.demographics?.ageMin).toBe(19);
    expect(parsed.personaQuery?.demographics?.ageMax).toBe(19);
  });

  it("rejects a missing limits block with a descriptive error path", () => {
    const cfg = {
      targetUrl: "https://example.test/",
      task: "x",
      safety: {
        allowedDomains: ["example.test"],
        blockPaymentSubmission: true,
        blockDestructiveActions: true,
        redactSensitiveFields: true,
      },
      artifacts: { screenshots: true, video: false, trace: false, rrweb: false },
    };
    const r = RunConfigSchema.safeParse(cfg);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(["limits"]);
    }
  });

  it("rejects a non-URL targetUrl", () => {
    const cfg = {
      targetUrl: "not a url",
      task: "x",
      limits: { maxDurationSec: 60, maxActions: 10 },
      safety: {
        allowedDomains: ["x"],
        blockPaymentSubmission: true,
        blockDestructiveActions: true,
        redactSensitiveFields: true,
      },
      artifacts: { screenshots: true, video: false, trace: false, rrweb: false },
    };
    const r = RunConfigSchema.safeParse(cfg);
    expect(r.success).toBe(false);
  });
});

describe("RunSchema", () => {
  it("hydrates a RunConfig with id + status into a persistable Run", () => {
    const cfg = loadJson("examples/run-config.checkout.json");
    const run = {
      id: "run_test_001",
      config: cfg,
      status: "queued" as const,
      createdAt: "2026-05-01T13:30:00+09:00",
      personaIds: [],
      counts: { events: 0, frictionSignals: 0, findings: 0 },
    };
    expect(() => RunSchema.parse(run)).not.toThrow();
  });

  it("rejects an unknown status", () => {
    const r = RunSchema.safeParse({
      id: "run_x",
      config: loadJson("examples/run-config.checkout.json"),
      status: "exploded",
      createdAt: "2026-05-01T13:30:00+09:00",
    });
    expect(r.success).toBe(false);
  });
});

describe("RunEventSchema", () => {
  it("accepts a snapshot+action+result event", () => {
    const event = {
      id: "evt_step3",
      runId: "run_test_001",
      personaId: "nemotron:Nemotron-Personas-Korea:row-12345",
      timestampMs: 1746077400123,
      stepIndex: 3,
      page: { url: "http://localhost:3100/checkout", title: "주문/결제" },
      observation: {
        visibleText: "예상 합계 약 49,000원~",
        interactiveElements: [
          {
            role: "button",
            label: "결제 확정",
            selector: "@e8",
            boundingBox: { x: 16, y: 720, width: 358, height: 48 },
          },
        ],
      },
      action: { type: "click", selector: "@e3", reason: "open shipping panel" },
      result: { urlChanged: false, domChanged: true, screenshotPath: "screenshots/3.png" },
      thoughtSummary: "배송비를 먼저 확인하고 싶다.",
    };
    expect(() => RunEventSchema.parse(event)).not.toThrow();
  });

  it("accepts an event with no action (pure observation)", () => {
    const event = {
      id: "evt_step0",
      runId: "run_test_001",
      personaId: "mock_1",
      timestampMs: 1,
      stepIndex: 0,
      page: { url: "http://localhost:3100/" },
    };
    expect(() => RunEventSchema.parse(event)).not.toThrow();
  });
});

describe("ArtifactSchema", () => {
  it("accepts a screenshot artifact", () => {
    const a = {
      id: "art_screenshot_3",
      runId: "run_test_001",
      type: "screenshot" as const,
      path: "artifacts/screenshots/3.png",
      contentType: "image/png",
      sizeBytes: 12345,
      createdAt: "2026-05-01T13:31:00+09:00",
      metadata: { stepIndex: 3 },
    };
    expect(() => ArtifactSchema.parse(a)).not.toThrow();
  });

  it("accepts a fix_prompt artifact with findingId metadata", () => {
    const a = {
      id: "art_fix_F-001",
      runId: "run_test_001",
      type: "fix_prompt" as const,
      path: "fix-prompts/F-001.md",
      createdAt: "2026-05-01T13:32:00+09:00",
      metadata: { findingId: "F-001" },
    };
    expect(() => ArtifactSchema.parse(a)).not.toThrow();
  });

  it("rejects an unknown artifact type", () => {
    const r = ArtifactSchema.safeParse({
      id: "x",
      runId: "y",
      type: "log",
      path: "z.txt",
      createdAt: "2026-05-01T00:00:00Z",
    });
    expect(r.success).toBe(false);
  });
});
