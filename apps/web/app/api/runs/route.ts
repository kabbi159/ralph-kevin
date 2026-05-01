import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/runs — synthesize a RunConfig and shell out to the CLI as a
// subprocess. We don't import @personabench/cli directly because it pulls
// in @duckdb/node-api's native bindings — webpack tries to bundle those
// for the server build and chokes on the .node addon. Subprocess gives us
// process isolation (live-mode browser stays sandboxed) plus a clean way
// to stream progress in the future.

type RunRequestBody = {
  targetUrl: string;
  task: string;
  successCriteria?: string[];
  allowedDomains?: string[];
  mode?: "scripted" | "scripted-multi" | "scripted-postfix" | "live";
  count?: number;
  lang?: "ko" | "en" | "auto";
  label?: string;
};

const inferAllowed = (url: string, override?: string[]): string[] => {
  if (override && override.length > 0) return override;
  try {
    const u = new URL(url);
    const host = u.hostname;
    const root = host.split(".").slice(-2).join(".");
    return Array.from(new Set([host, root]));
  } catch {
    return ["localhost"];
  }
};

const repoRootDir = (): string => resolve(process.cwd(), "..", "..");

const runCliSubprocess = (
  repoRoot: string,
  args: string[],
  env: Record<string, string | undefined>,
): Promise<{ exitCode: number; stdout: string; stderr: string }> =>
  new Promise((resolveRun, rejectRun) => {
    const proc = spawn("pnpm", ["exec", "tsx", "packages/cli/src/bin.ts", ...args], {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    proc.on("error", rejectRun);
    proc.on("close", (exitCode) => {
      resolveRun({ exitCode: exitCode ?? -1, stdout, stderr });
    });
  });

const tagRun = (
  runsRoot: string,
  runId: string,
  label: string | undefined,
  targetUrl: string,
): void => {
  if (!label) return;
  const runDir = join(runsRoot, runId);
  if (!existsSync(runDir)) return;
  writeFileSync(
    join(runDir, "label.json"),
    JSON.stringify({ label, targetUrl, scenario: detectScenario(targetUrl) }, null, 2),
  );
};

const detectScenario = (url: string): string => {
  if (url.includes("crack.wrtn.ai")) return "crack-live";
  if (url.includes("localhost:3100")) return "local-checkout";
  if (url.startsWith("https://")) return "external-live";
  return "custom";
};

const newestRunId = (runsRoot: string, since: number): string | null => {
  if (!existsSync(runsRoot)) return null;
  const entries = readdirSync(runsRoot)
    .filter((id) => statSync(join(runsRoot, id)).isDirectory())
    .map((id) => ({ id, ctime: statSync(join(runsRoot, id)).ctimeMs }))
    .filter((e) => e.ctime >= since)
    .sort((a, b) => b.ctime - a.ctime);
  return entries[0]?.id ?? null;
};

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = (await req.json()) as RunRequestBody;
    if (!body.targetUrl || !body.task) {
      return NextResponse.json({ error: "targetUrl and task are required" }, { status: 400 });
    }

    const repoRoot = repoRootDir();
    const runsRoot = join(repoRoot, ".personabench", "runs");

    const cfg = {
      targetUrl: body.targetUrl,
      task: body.task,
      successCriteria: body.successCriteria,
      limits: { maxDurationSec: 240, maxActions: 30 },
      safety: {
        allowedDomains: inferAllowed(body.targetUrl, body.allowedDomains),
        blockPaymentSubmission: true,
        blockDestructiveActions: true,
        redactSensitiveFields: true,
      },
      artifacts: { screenshots: true, video: false, trace: false, rrweb: false },
    };
    const cfgPath = join(tmpdir(), `personabench-web-${Date.now()}.json`);
    writeFileSync(cfgPath, JSON.stringify(cfg));

    if (!existsSync(runsRoot)) mkdirSync(runsRoot, { recursive: true });
    const sinceMs = Date.now();

    const mode = body.mode ?? "scripted-multi";
    const count = body.count ?? 1;

    const cliArgs = ["run", "--config", cfgPath, "--mode", mode, "--lang", body.lang ?? "ko"];
    if (count > 1) cliArgs.push("--count", String(count));

    const result = await runCliSubprocess(repoRoot, cliArgs, {});
    if (result.exitCode !== 0) {
      return NextResponse.json(
        {
          error: "cli subprocess failed",
          exitCode: result.exitCode,
          stderr: result.stderr.slice(-2000),
          stdout: result.stdout.slice(-2000),
        },
        { status: 500 },
      );
    }

    // Find the newest run dir created since we started — that's ours.
    const runId = newestRunId(runsRoot, sinceMs);
    if (!runId) {
      return NextResponse.json(
        { error: "run completed but run dir not found", stdout: result.stdout },
        { status: 500 },
      );
    }
    tagRun(runsRoot, runId, body.label, body.targetUrl);

    // For batch runs, also tag any newer dirs created in the same window.
    if (count > 1) {
      const batchEntries = readdirSync(runsRoot).filter(
        (id) => statSync(join(runsRoot, id)).ctimeMs >= sinceMs,
      );
      for (const id of batchEntries) tagRun(runsRoot, id, body.label, body.targetUrl);
      const findingsPath = join(runsRoot, runId, "findings.json");
      const findings = existsSync(findingsPath)
        ? (JSON.parse(readFileSync(findingsPath, "utf8")) as unknown[])
        : [];
      return NextResponse.json({
        batchId: `batch_${sinceMs}`,
        runs: batchEntries.map((id) => ({
          id,
          reportPath: join(runsRoot, id, "report.html"),
        })),
        runId,
        findingCount: findings.length,
      });
    }

    const findingsPath = join(runsRoot, runId, "findings.json");
    const findings = existsSync(findingsPath)
      ? (JSON.parse(readFileSync(findingsPath, "utf8")) as unknown[])
      : [];
    return NextResponse.json({
      runId,
      reportPath: join(runsRoot, runId, "report.html"),
      findingCount: findings.length,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
