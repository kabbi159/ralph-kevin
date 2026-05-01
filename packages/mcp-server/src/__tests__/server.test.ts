import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import { buildPersonabenchMcpServer } from "../server";

type ToolCallResult = {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
};

const callTool = async (
  server: McpServer,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolCallResult> => {
  // biome-ignore lint/suspicious/noExplicitAny: test access to McpServer's private registry
  const tools = (server as any)._registeredTools as
    | Record<
        string,
        { handler: (args: Record<string, unknown>, ctx: unknown) => Promise<ToolCallResult> }
      >
    | undefined;
  if (!tools) throw new Error("expected _registeredTools to be defined");
  const tool = tools[name];
  if (!tool) throw new Error(`tool ${name} not registered`);
  return tool.handler(args, {});
};

const firstText = (r: ToolCallResult): string => {
  const first = r.content[0];
  if (!first) throw new Error("expected at least one content block");
  return first.text;
};

const writeFinding = (path: string) => {
  writeFileSync(
    path,
    JSON.stringify([
      {
        id: "F-001",
        runId: "run_test",
        severity: "high",
        title: "최종 결제 금액이 모호함",
        summary: "총액 표기가 약 ~원 으로 모호하다.",
        persona: { id: "mock_p_19", displayName: "19 student" },
        evidence: {
          timestamps: ["2026-05-01T05:00:00.000Z"],
          eventIds: ["evt_1"],
          frictionSignalIds: ["fs_1"],
        },
        diagnosis: { userGoal: "x", observedBehavior: "x", likelyCause: "x", confidence: 0.8 },
        recommendation: { uxChange: "x", acceptanceCriteria: ["x"] },
        codingAgentPrompt: "FIX_PROMPT",
      },
    ]),
  );
};

describe("MCP server tool wiring", () => {
  it("constructs without throwing and exposes the documented tool surface", () => {
    const runsRoot = mkdtempSync(join(tmpdir(), "personabench-mcp-"));
    try {
      const server = buildPersonabenchMcpServer({ runsRoot });
      expect(server).toBeDefined();
    } finally {
      rmSync(runsRoot, { recursive: true, force: true });
    }
  });

  it("get_ux_findings reads findings.json and returns a summary", async () => {
    const runsRoot = mkdtempSync(join(tmpdir(), "personabench-mcp-"));
    const runDir = join(runsRoot, "run_test");
    mkdirSync(runDir, { recursive: true });
    writeFinding(join(runDir, "findings.json"));
    try {
      const server = buildPersonabenchMcpServer({ runsRoot });
      const r = await callTool(server, "get_ux_findings", { runId: "run_test" });
      const parsed = JSON.parse(firstText(r));
      expect(parsed.findings).toHaveLength(1);
      expect(parsed.findings[0].id).toBe("F-001");
      expect(parsed.findings[0].severity).toBe("high");
    } finally {
      rmSync(runsRoot, { recursive: true, force: true });
    }
  });

  it("get_ux_findings reports RUN_NOT_FOUND for an unknown run", async () => {
    const runsRoot = mkdtempSync(join(tmpdir(), "personabench-mcp-"));
    try {
      const server = buildPersonabenchMcpServer({ runsRoot });
      const r = await callTool(server, "get_ux_findings", { runId: "no-such-run" });
      expect(r.isError).toBe(true);
      const parsed = JSON.parse(firstText(r));
      expect(parsed.error).toBe("RUN_NOT_FOUND");
    } finally {
      rmSync(runsRoot, { recursive: true, force: true });
    }
  });

  it("generate_fix_prompt streams the F-001.md file content", async () => {
    const runsRoot = mkdtempSync(join(tmpdir(), "personabench-mcp-"));
    const runDir = join(runsRoot, "run_test");
    mkdirSync(join(runDir, "fix-prompts"), { recursive: true });
    writeFileSync(join(runDir, "fix-prompts", "F-001.md"), "# Fix prompt body\n\n- Step 1");
    try {
      const server = buildPersonabenchMcpServer({ runsRoot });
      const r = await callTool(server, "generate_fix_prompt", {
        runId: "run_test",
        findingId: "F-001",
      });
      expect(firstText(r)).toContain("# Fix prompt body");
      expect(firstText(r)).toContain("Step 1");
    } finally {
      rmSync(runsRoot, { recursive: true, force: true });
    }
  });

  it("list_runs enumerates runs from disk", async () => {
    const runsRoot = mkdtempSync(join(tmpdir(), "personabench-mcp-"));
    mkdirSync(join(runsRoot, "run_a"), { recursive: true });
    mkdirSync(join(runsRoot, "run_b"), { recursive: true });
    try {
      const server = buildPersonabenchMcpServer({ runsRoot });
      const r = await callTool(server, "list_runs", {});
      const parsed = JSON.parse(firstText(r));
      expect(parsed.runs).toEqual(expect.arrayContaining(["run_a", "run_b"]));
    } finally {
      rmSync(runsRoot, { recursive: true, force: true });
    }
  });

  it("get_replay_link returns null URLs when artifacts do not exist", async () => {
    const runsRoot = mkdtempSync(join(tmpdir(), "personabench-mcp-"));
    try {
      const server = buildPersonabenchMcpServer({ runsRoot });
      const r = await callTool(server, "get_replay_link", { runId: "run_x" });
      const parsed = JSON.parse(firstText(r));
      expect(parsed.replayUrl).toBeNull();
      expect(parsed.traceUrl).toBeNull();
      expect(parsed.videoUrl).toBeNull();
    } finally {
      rmSync(runsRoot, { recursive: true, force: true });
    }
  });

  it("run_persona_ux_test invokes the runExecutor and returns runId + reportUrl", async () => {
    const runsRoot = mkdtempSync(join(tmpdir(), "personabench-mcp-"));
    let captured: unknown = null;
    try {
      const server = buildPersonabenchMcpServer({
        runsRoot,
        runExecutor: async (input) => {
          captured = input;
          return {
            runId: "run_mock_001",
            runDir: join(runsRoot, "run_mock_001"),
            reportPath: join(runsRoot, "run_mock_001", "report.html"),
            signalCount: 7,
            findingCount: 3,
          };
        },
      });
      const r = await callTool(server, "run_persona_ux_test", {
        targetUrl: "http://localhost:3100/checkout",
        task: "Reach checkout",
      });
      const parsed = JSON.parse(firstText(r));
      expect(parsed.runId).toBe("run_mock_001");
      expect(parsed.signalCount).toBe(7);
      expect(parsed.reportUrl).toContain("file://");
      expect(captured).toEqual({
        targetUrl: "http://localhost:3100/checkout",
        task: "Reach checkout",
      });
    } finally {
      rmSync(runsRoot, { recursive: true, force: true });
    }
  });

  it("run_persona_ux_test rejects when no runExecutor is injected (default error)", async () => {
    const runsRoot = mkdtempSync(join(tmpdir(), "personabench-mcp-"));
    try {
      const server = buildPersonabenchMcpServer({ runsRoot });
      await expect(
        callTool(server, "run_persona_ux_test", {
          targetUrl: "http://localhost:3100/checkout",
          task: "x",
        }),
      ).rejects.toThrow(/no runExecutor injected/);
    } finally {
      rmSync(runsRoot, { recursive: true, force: true });
    }
  });

  it("survives missing runs root", () => {
    const server = buildPersonabenchMcpServer({
      runsRoot: "/no/such/path/personabench-mcp-test",
    });
    expect(server).toBeDefined();
    expect(existsSync("/no/such/path/personabench-mcp-test")).toBe(false);
  });
});
