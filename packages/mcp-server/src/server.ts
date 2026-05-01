import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { UXFindingSchema } from "@personabench/core";
import { z } from "zod";

// Minimal MCP server exposing PersonaBench's primary tools per docs/06
// §MCP tool contracts. Stdio transport so a separate Claude Code or Codex
// session can spawn `personabench mcp` and call tools directly.
//
// `run_persona_ux_test` is wired to invoke the same scripted-run pipeline
// the CLI uses; the `--live` mode remains deferred per .ralph/spec-changes.md.

export type ServerOpts = {
  // Override the default runs root (used by tests).
  runsRoot?: string;
  // Pluggable run executor — defaults to dynamically importing the CLI's
  // runCommand at first invocation. Tests can pass a fake.
  runExecutor?: (input: {
    targetUrl: string;
    task: string;
    successCriteria?: string[];
    sampleSize?: number;
    maxDurationSec?: number;
  }) => Promise<{
    runId: string;
    runDir: string;
    reportPath: string;
    signalCount: number;
    findingCount: number;
  }>;
};

const RUNS_ROOT_DEFAULT = resolvePath(process.cwd(), ".personabench", "runs");

// Default executor used when the CLI bin.ts hasn't injected its own.
// Returns an error contract so the caller knows to wire `--executor`.
const defaultExecutor: NonNullable<ServerOpts["runExecutor"]> = () =>
  Promise.reject(
    new Error(
      "personabench mcp: no runExecutor injected. The CLI bin.ts wires this; running the server module directly without an executor is not supported.",
    ),
  );

const enumerateRuns = (root: string): string[] => {
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((id) => statSync(join(root, id)).isDirectory())
    .sort()
    .reverse();
};

export const buildPersonabenchMcpServer = (opts: ServerOpts = {}): McpServer => {
  const runsRoot = opts.runsRoot ?? RUNS_ROOT_DEFAULT;
  const runExecutor = opts.runExecutor ?? defaultExecutor;

  const server = new McpServer(
    { name: "personabench", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.tool(
    "run_persona_ux_test",
    {
      targetUrl: z.string().url().describe("URL to test"),
      task: z.string().min(1).describe("Task the persona should attempt"),
      successCriteria: z.array(z.string()).optional(),
      sampleSize: z.number().int().positive().max(10).optional(),
      maxDurationSec: z.number().int().positive().max(600).optional(),
    },
    async (args) => {
      const r = await runExecutor(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                runId: r.runId,
                status: "completed",
                signalCount: r.signalCount,
                findingCount: r.findingCount,
                reportUrl: `file://${r.reportPath}`,
                runDir: r.runDir,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "get_ux_findings",
    {
      runId: z.string().min(1),
    },
    async ({ runId }) => {
      const path = join(runsRoot, runId, "findings.json");
      if (!existsSync(path)) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "RUN_NOT_FOUND", runId }) }],
          isError: true,
        };
      }
      const arr = JSON.parse(readFileSync(path, "utf8")) as unknown[];
      const findings = arr.map((f) => UXFindingSchema.parse(f));
      const summary = findings.map((f) => ({
        id: f.id,
        severity: f.severity,
        title: f.title,
        summary: f.summary,
      }));
      return { content: [{ type: "text", text: JSON.stringify({ findings: summary }, null, 2) }] };
    },
  );

  server.tool(
    "get_replay_link",
    {
      runId: z.string().min(1),
    },
    async ({ runId }) => {
      const reportPath = join(runsRoot, runId, "report.html");
      const tracePath = join(runsRoot, runId, "artifacts", "trace.zip");
      const videoPath = join(runsRoot, runId, "artifacts", "video.webm");
      const out = {
        replayUrl: existsSync(reportPath) ? `file://${reportPath}` : null,
        traceUrl: existsSync(tracePath) ? `file://${tracePath}` : null,
        videoUrl: existsSync(videoPath) ? `file://${videoPath}` : null,
      };
      return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
    },
  );

  server.tool(
    "generate_fix_prompt",
    {
      runId: z.string().min(1),
      findingId: z.string().min(1),
    },
    async ({ runId, findingId }) => {
      const path = join(runsRoot, runId, "fix-prompts", `${findingId}.md`);
      if (!existsSync(path)) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "FINDING_NOT_FOUND", runId, findingId }),
            },
          ],
          isError: true,
        };
      }
      const prompt = readFileSync(path, "utf8");
      return { content: [{ type: "text", text: prompt }] };
    },
  );

  server.tool("list_runs", {}, async () => {
    const ids = enumerateRuns(runsRoot);
    return {
      content: [{ type: "text", text: JSON.stringify({ runs: ids.slice(0, 25) }, null, 2) }],
    };
  });

  return server;
};

export const startStdioServer = async (opts: ServerOpts = {}): Promise<void> => {
  const server = buildPersonabenchMcpServer(opts);
  const transport = new StdioServerTransport();
  await server.connect(transport);
};
