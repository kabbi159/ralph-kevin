import { type SpawnFn, realSpawnAgentBrowser } from "./spawn-agent-browser";

// AgentBrowserSession — long-lived per-run wrapper around the `agent-browser`
// CLI. Each method invokes the binary with `--session <id>` so multiple
// concurrent runs do not collide. Per AGENTS.md / docs/04 §Browser substrate
// the runner does NOT use `agent-browser chat` — the chat command is fixed
// to the Vercel AI Gateway and incompatible with persona injection.

export type AgentBrowserViewport = "mobile" | "desktop" | { width: number; height: number };

export type SessionOpts = {
  sessionId: string;
  allowedDomains?: string[];
  viewport?: AgentBrowserViewport;
  onIO?: (line: { stream: "stdout" | "stderr"; text: string; argv: string[] }) => void;
  // Injection seam for unit tests — real runs use realSpawnAgentBrowser.
  spawnFn?: SpawnFn;
  // Default per-command timeout. Caller can pass a tighter one per command.
  defaultCommandTimeoutMs?: number;
};

export type RawSnapshot = {
  origin: string;
  snapshot: unknown;
  refs: Record<string, { role?: string; name?: string }>;
};

export type SnapshotResult = {
  raw: RawSnapshot;
  // Stringified JSON we observed on stdout — preserved verbatim so the
  // recorder can persist it under .personabench/runs/<runId>/observations/.
  rawJson: string;
};

const renderViewport = (v: AgentBrowserViewport | undefined): string | null => {
  if (!v) return null;
  if (typeof v === "string") return v;
  return `${v.width}x${v.height}`;
};

export class AgentBrowserSession {
  private readonly opts: SessionOpts;
  private readonly spawnFn: SpawnFn;
  private opened = false;

  constructor(opts: SessionOpts) {
    this.opts = opts;
    this.spawnFn = opts.spawnFn ?? realSpawnAgentBrowser;
  }

  get sessionId(): string {
    return this.opts.sessionId;
  }

  get isOpen(): boolean {
    return this.opened;
  }

  // Build the canonical argv for any command.
  private argv(command: string, ...rest: string[]): string[] {
    const base = ["--session", this.opts.sessionId];
    return [...base, command, ...rest];
  }

  private async invoke(
    args: string[],
    timeoutMs?: number,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const result = await this.spawnFn(args, {
      timeoutMs: timeoutMs ?? this.opts.defaultCommandTimeoutMs,
    });
    if (this.opts.onIO) {
      if (result.stdout) {
        this.opts.onIO({ stream: "stdout", text: result.stdout, argv: args });
      }
      if (result.stderr) {
        this.opts.onIO({ stream: "stderr", text: result.stderr, argv: args });
      }
    }
    return result;
  }

  async open(url: string): Promise<{ origin: string }> {
    const args: string[] = ["--session", this.opts.sessionId];
    if (this.opts.allowedDomains?.length) {
      args.push("--allowed-domains", this.opts.allowedDomains.join(","));
    }
    const vp = renderViewport(this.opts.viewport);
    if (vp) args.push("--viewport", vp);
    args.push("open", url);
    const r = await this.invoke(args, 30_000);
    if (r.exitCode !== 0) {
      throw new Error(`agent-browser open failed (exit=${r.exitCode}): ${r.stderr.trim()}`);
    }
    this.opened = true;
    let origin = "";
    try {
      const parsed = JSON.parse(r.stdout);
      if (parsed?.success && typeof parsed?.data?.origin === "string") {
        origin = parsed.data.origin;
      }
    } catch {
      // open command does not always return JSON; keep origin empty.
    }
    if (!origin) {
      try {
        const u = new URL(url);
        origin = u.origin;
      } catch {
        // bubble up: caller should pass a valid URL
        throw new Error(`agent-browser open: targetUrl is not a valid URL: ${url}`);
      }
    }
    return { origin };
  }

  async snapshot(): Promise<SnapshotResult> {
    const r = await this.invoke(this.argv("snapshot", "--json"), 30_000);
    if (r.exitCode !== 0) {
      throw new Error(`agent-browser snapshot failed (exit=${r.exitCode}): ${r.stderr.trim()}`);
    }
    const parsed = JSON.parse(r.stdout) as {
      success?: boolean;
      data?: RawSnapshot;
      error?: string;
    };
    if (!parsed?.success || !parsed.data) {
      throw new Error(`agent-browser snapshot returned no data: ${parsed?.error ?? r.stderr}`);
    }
    return { raw: parsed.data, rawJson: r.stdout };
  }

  async click(ref: string): Promise<void> {
    const r = await this.invoke(this.argv("click", `@${ref.replace(/^@/, "")}`), 15_000);
    if (r.exitCode !== 0) {
      throw new Error(`agent-browser click @${ref} failed: ${r.stderr.trim()}`);
    }
  }

  async fill(ref: string, text: string): Promise<void> {
    const r = await this.invoke(this.argv("fill", `@${ref.replace(/^@/, "")}`, text), 15_000);
    if (r.exitCode !== 0) {
      throw new Error(`agent-browser fill @${ref} failed: ${r.stderr.trim()}`);
    }
  }

  async scroll(direction: "up" | "down"): Promise<void> {
    const r = await this.invoke(this.argv("scroll", direction), 10_000);
    if (r.exitCode !== 0) {
      throw new Error(`agent-browser scroll ${direction} failed: ${r.stderr.trim()}`);
    }
  }

  async back(): Promise<void> {
    const r = await this.invoke(this.argv("back"), 10_000);
    if (r.exitCode !== 0) {
      throw new Error(`agent-browser back failed: ${r.stderr.trim()}`);
    }
  }

  async press(key: string): Promise<void> {
    const r = await this.invoke(this.argv("press", key), 5_000);
    if (r.exitCode !== 0) {
      throw new Error(`agent-browser press ${key} failed: ${r.stderr.trim()}`);
    }
  }

  async screenshot(path: string): Promise<void> {
    const r = await this.invoke(this.argv("screenshot", path), 15_000);
    if (r.exitCode !== 0) {
      throw new Error(`agent-browser screenshot ${path} failed: ${r.stderr.trim()}`);
    }
  }

  async traceStart(): Promise<void> {
    const r = await this.invoke(this.argv("trace", "start"), 5_000);
    if (r.exitCode !== 0) {
      throw new Error(`agent-browser trace start failed: ${r.stderr.trim()}`);
    }
  }

  async traceStop(): Promise<void> {
    const r = await this.invoke(this.argv("trace", "stop"), 5_000);
    if (r.exitCode !== 0) {
      throw new Error(`agent-browser trace stop failed: ${r.stderr.trim()}`);
    }
  }

  async close(): Promise<void> {
    if (!this.opened) return;
    try {
      const r = await this.invoke(this.argv("close"), 10_000);
      if (r.exitCode !== 0) {
        // Closing should be best-effort — log via onIO but do not throw.
        this.opts.onIO?.({
          stream: "stderr",
          text: `agent-browser close non-zero exit (${r.exitCode}): ${r.stderr}`,
          argv: this.argv("close"),
        });
      }
    } finally {
      this.opened = false;
    }
  }
}
