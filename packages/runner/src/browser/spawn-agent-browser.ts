import { spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";

// Thin spawn helper around `agent-browser`. Kept in its own module so unit
// tests can inject a fake `runAgentBrowser` that records the argv it would
// have forwarded — no real subprocess required to assert command shape.

export type AgentBrowserResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type SpawnFn = (
  args: string[],
  opts?: { input?: string; timeoutMs?: number },
) => Promise<AgentBrowserResult>;

const DEFAULT_TIMEOUT_MS = 60_000;

// Locate the agent-browser CLI script. pnpm 10's strict isolation hides the
// binary from PATH, so we walk up from cwd looking for the workspace's
// .pnpm store entry. Returns the resolved absolute path or null if not found.
const findAgentBrowserScript = (): string | null => {
  const visited = new Set<string>();
  let dir = resolve(process.cwd());
  for (let i = 0; i < 8; i++) {
    if (visited.has(dir)) break;
    visited.add(dir);
    const candidates = [
      join(dir, "node_modules/agent-browser/bin/agent-browser.js"),
      join(
        dir,
        "node_modules/.pnpm/agent-browser@0.26.0/node_modules/agent-browser/bin/agent-browser.js",
      ),
    ];
    for (const c of candidates) {
      try {
        if (existsSync(c)) return realpathSync(c);
      } catch {
        // continue
      }
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return null;
};

export const realSpawnAgentBrowser: SpawnFn = (args, opts = {}) => {
  return new Promise((resolveRun, rejectRun) => {
    const script = findAgentBrowserScript();
    const cmd = script ? "node" : "agent-browser";
    const argv = script ? [script, ...args] : args;
    const proc = spawn(cmd, argv, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timer: NodeJS.Timeout | undefined;
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        proc.kill("SIGTERM");
        rejectRun(new Error(`agent-browser timed out after ${timeoutMs}ms: ${args.join(" ")}`));
      }, timeoutMs);
    }
    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    proc.on("error", (err) => {
      if (timer) clearTimeout(timer);
      rejectRun(err);
    });
    proc.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolveRun({ exitCode: code ?? -1, stdout, stderr });
    });
    if (opts.input) {
      proc.stdin.end(opts.input);
    } else {
      proc.stdin.end();
    }
  });
};
