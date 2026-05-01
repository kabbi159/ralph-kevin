import { spawn } from "node:child_process";

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

export const realSpawnAgentBrowser: SpawnFn = (args, opts = {}) => {
  return new Promise((resolve, reject) => {
    const proc = spawn("agent-browser", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timer: NodeJS.Timeout | undefined;
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        proc.kill("SIGTERM");
        reject(new Error(`agent-browser timed out after ${timeoutMs}ms: ${args.join(" ")}`));
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
      reject(err);
    });
    proc.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ exitCode: code ?? -1, stdout, stderr });
    });
    if (opts.input) {
      proc.stdin.end(opts.input);
    } else {
      proc.stdin.end();
    }
  });
};
