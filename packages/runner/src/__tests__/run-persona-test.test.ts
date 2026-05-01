import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PersonaUXProfile, RunConfig } from "@personabench/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgentBrowserSession } from "../browser/agent-browser-session";
import type { SpawnFn } from "../browser/spawn-agent-browser";
import { MockDecisionProvider } from "../decide/mock-decision-provider";
import { createFileEventSink, createMemoryEventSink } from "../event-log";
import { runPersonaTest } from "../run-persona-test";

const fakeSnapshotJson = JSON.stringify({
  success: true,
  data: {
    origin: "http://localhost:3100",
    snapshot: { children: [{ text: "주문/결제" }, { text: "결제 확정" }] },
    refs: {
      e1: { role: "heading", name: "주문/결제" },
      e3: { role: "button", name: "배송 정보" },
      e8: { role: "button", name: "결제 확정" },
    },
  },
});

const KNOWN = new Set([
  "open",
  "snapshot",
  "click",
  "fill",
  "scroll",
  "back",
  "press",
  "screenshot",
  "trace",
  "close",
]);

const buildSpawn = (
  responses: Record<string, { stdout?: string; stderr?: string; exitCode?: number }>,
  options: { snapshotOriginOverride?: () => string | null } = {},
): { spawnFn: SpawnFn; argvLog: string[][] } => {
  const argvLog: string[][] = [];
  const spawnFn: SpawnFn = async (args) => {
    argvLog.push([...args]);
    const cmd = args.find((a) => KNOWN.has(a)) ?? "unknown";
    if (cmd === "snapshot") {
      const override = options.snapshotOriginOverride?.();
      const stdout =
        override !== null && override !== undefined
          ? JSON.stringify({
              success: true,
              data: { origin: override, snapshot: {}, refs: {} },
            })
          : (responses.snapshot?.stdout ?? fakeSnapshotJson);
      return {
        exitCode: responses.snapshot?.exitCode ?? 0,
        stdout,
        stderr: responses.snapshot?.stderr ?? "",
      };
    }
    const r = responses[cmd] ?? {};
    return {
      exitCode: r.exitCode ?? 0,
      stdout: r.stdout ?? "",
      stderr: r.stderr ?? "",
    };
  };
  return { spawnFn, argvLog };
};

const makeConfig = (overrides: Partial<RunConfig> = {}): RunConfig => ({
  targetUrl: "http://localhost:3100/checkout",
  task: "Reach payment confirmation without paying for real.",
  limits: { maxDurationSec: 60, maxActions: 5 },
  safety: {
    allowedDomains: ["localhost"],
    blockPaymentSubmission: true,
    blockDestructiveActions: true,
    redactSensitiveFields: true,
  },
  artifacts: { screenshots: false, video: false, trace: false, rrweb: false },
  ...overrides,
});

const makePersona = (): PersonaUXProfile => ({
  personaId: "mock_test_42",
  displayName: "Test persona",
  sourceProvenance: { provider: "mock", dataset: "fixture/test" },
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
  promptBlock: "Persona prompt.",
});

describe("runPersonaTest orchestrator", () => {
  it("walks a 3-step plan and stops on action.type='stop' with outcome=success", async () => {
    const { spawnFn, argvLog } = buildSpawn({});
    const browser = new AgentBrowserSession({ sessionId: "run_t1", spawnFn });
    const provider = new MockDecisionProvider([
      { type: "click", selector: "@e3", reason: "open shipping" },
      { type: "scroll", direction: "down", reason: "look for total" },
      { type: "stop", outcome: "success", reason: "found total" },
    ]);
    const { sink, events } = createMemoryEventSink();
    const r = await runPersonaTest({
      runId: "run_t1",
      personaProfile: makePersona(),
      config: makeConfig(),
      decisionProvider: provider,
      browser,
      runDir: "/tmp/personabench-test-run",
      eventSink: sink,
    });
    expect(r.stopReason).toBe("success");
    expect(events.length).toBeGreaterThanOrEqual(3);
    // last event's action.type is stop
    const last = events.at(-1);
    expect(last?.action?.type).toBe("stop");
    // close was called
    expect(argvLog.at(-1)?.includes("close")).toBe(true);
  });

  it("blocks a payment-confirmation click and stops with payment_blocked", async () => {
    const { spawnFn } = buildSpawn({});
    const browser = new AgentBrowserSession({ sessionId: "run_pay", spawnFn });
    const provider = new MockDecisionProvider([
      { type: "click", selector: "@e8", reason: "결제 확정 누르기" },
    ]);
    const { sink, events } = createMemoryEventSink();
    const r = await runPersonaTest({
      runId: "run_pay",
      personaProfile: makePersona(),
      config: makeConfig(),
      decisionProvider: provider,
      browser,
      runDir: "/tmp/personabench-test-run",
      eventSink: sink,
    });
    expect(r.stopReason).toBe("payment_blocked");
    const blocked = events.find((e) => e.result?.errorText?.includes("payment_blocked"));
    expect(blocked).toBeDefined();
  });

  it("stops with action_limit when maxActions is reached without action.type='stop'", async () => {
    const { spawnFn } = buildSpawn({});
    const browser = new AgentBrowserSession({ sessionId: "run_limit", spawnFn });
    const provider = new MockDecisionProvider([
      { type: "scroll", direction: "down", reason: "1" },
      { type: "scroll", direction: "down", reason: "2" },
      { type: "scroll", direction: "down", reason: "3" },
      { type: "scroll", direction: "down", reason: "4" },
      { type: "scroll", direction: "down", reason: "5" },
      { type: "scroll", direction: "down", reason: "6" },
    ]);
    const { sink } = createMemoryEventSink();
    const r = await runPersonaTest({
      runId: "run_limit",
      personaProfile: makePersona(),
      config: makeConfig({ limits: { maxDurationSec: 60, maxActions: 3 } }),
      decisionProvider: provider,
      browser,
      runDir: "/tmp/personabench-test-run",
      eventSink: sink,
    });
    expect(r.stopReason).toBe("action_limit");
  });

  it("stops with timeout when the wall-clock deadline passes", async () => {
    const { spawnFn } = buildSpawn({});
    const browser = new AgentBrowserSession({ sessionId: "run_to", spawnFn });
    const provider = new MockDecisionProvider([
      { type: "scroll", direction: "down", reason: "loop" },
    ]);
    const { sink } = createMemoryEventSink();
    let t = 0;
    const r = await runPersonaTest({
      runId: "run_to",
      personaProfile: makePersona(),
      config: makeConfig({ limits: { maxDurationSec: 1, maxActions: 100 } }),
      decisionProvider: provider,
      browser,
      runDir: "/tmp/personabench-test-run",
      eventSink: sink,
      now: () => {
        t += 600;
        return t;
      },
    });
    expect(r.stopReason).toBe("timeout");
  });

  it("stops with domain_not_allowed if the snapshot origin escapes the allowlist", async () => {
    const origins = ["http://localhost:3100", "https://evil.example.com"];
    const { spawnFn } = buildSpawn({}, { snapshotOriginOverride: () => origins.shift() ?? null });
    const browser = new AgentBrowserSession({ sessionId: "run_redir", spawnFn });
    const provider = new MockDecisionProvider([
      { type: "click", selector: "@e3", reason: "step 1" },
      { type: "click", selector: "@e3", reason: "step 2" },
    ]);
    const { sink, events } = createMemoryEventSink();
    const r = await runPersonaTest({
      runId: "run_redir",
      personaProfile: makePersona(),
      config: makeConfig({
        safety: {
          allowedDomains: ["localhost"],
          blockPaymentSubmission: true,
          blockDestructiveActions: true,
          redactSensitiveFields: true,
        },
      }),
      decisionProvider: provider,
      browser,
      runDir: "/tmp/personabench-test-run",
      eventSink: sink,
    });
    expect(r.stopReason).toBe("domain_not_allowed");
    expect(events.some((e) => e.result?.errorText?.includes("domain_not_allowed"))).toBe(true);
  });

  it("writes events as ndjson to disk via createFileEventSink", () => {
    const dir = mkdtempSync(join(tmpdir(), "personabench-event-"));
    const path = join(dir, "events.ndjson");
    const sink = createFileEventSink(path);
    sink({
      id: "evt_a",
      runId: "run_x",
      personaId: "p1",
      timestampMs: 1,
      stepIndex: 0,
      page: { url: "http://x/" },
    });
    sink({
      id: "evt_b",
      runId: "run_x",
      personaId: "p1",
      timestampMs: 2,
      stepIndex: 1,
      page: { url: "http://x/" },
      action: { type: "back", reason: "test" },
    });
    const lines = readFileSync(path, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).id).toBe("evt_a");
    expect(JSON.parse(lines[1]!).action.type).toBe("back");
    rmSync(dir, { recursive: true, force: true });
  });
});

beforeEach(() => {
  // no-op
});
afterEach(() => {
  // no-op
});
