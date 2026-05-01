import { describe, expect, it, vi } from "vitest";
import { AgentBrowserSession } from "../browser/agent-browser-session";
import type { SpawnFn } from "../browser/spawn-agent-browser";

const fakeSnapshotJson = JSON.stringify({
  success: true,
  data: {
    origin: "http://localhost:3100",
    snapshot: { kind: "tree", nodes: [] },
    refs: {
      e1: { role: "heading", name: "주문/결제" },
      e3: { role: "button", name: "배송 정보" },
      e8: { role: "button", name: "결제 확정" },
    },
  },
});

const KNOWN_COMMANDS = new Set([
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
): { spawnFn: SpawnFn; argvLog: string[][] } => {
  const argvLog: string[][] = [];
  const spawnFn: SpawnFn = async (args) => {
    argvLog.push([...args]);
    // Pick the first arg that matches a known command verb. open carries
    // optional --allowed-domains / --viewport flags before the verb, so a
    // simple "right after --session" lookup misses it.
    const cmd = args.find((a) => KNOWN_COMMANDS.has(a)) ?? "unknown";
    const r = responses[cmd] ?? {};
    return {
      exitCode: r.exitCode ?? 0,
      stdout: r.stdout ?? "",
      stderr: r.stderr ?? "",
    };
  };
  return { spawnFn, argvLog };
};

describe("AgentBrowserSession argv shape", () => {
  it("open passes --session, --allowed-domains, then `open <url>`; viewport is set in a follow-up call", async () => {
    const { spawnFn, argvLog } = buildSpawn({});
    const sess = new AgentBrowserSession({
      sessionId: "run_test",
      allowedDomains: ["localhost", "example.test"],
      viewport: "mobile",
      spawnFn,
    });
    await sess.open("http://localhost:3100/checkout");
    expect(argvLog[0]).toEqual([
      "--session",
      "run_test",
      "--allowed-domains",
      "localhost,example.test",
      "open",
      "http://localhost:3100/checkout",
    ]);
    // viewport is a separate subcommand, dispatched right after open succeeds
    expect(argvLog[1]).toEqual(["--session", "run_test", "viewport", "390", "844"]);
  });

  it("supports a {width,height} viewport via follow-up viewport subcommand", async () => {
    const { spawnFn, argvLog } = buildSpawn({});
    const sess = new AgentBrowserSession({
      sessionId: "run_w",
      viewport: { width: 390, height: 844 },
      spawnFn,
    });
    await sess.open("http://localhost:3100/");
    expect(argvLog[1]).toEqual(["--session", "run_w", "viewport", "390", "844"]);
  });

  it("snapshot --json parses {origin, snapshot, refs} and exposes raw json verbatim", async () => {
    const { spawnFn, argvLog } = buildSpawn({ snapshot: { stdout: fakeSnapshotJson } });
    const sess = new AgentBrowserSession({ sessionId: "run_s", spawnFn });
    await sess.open("http://localhost:3100/");
    const snap = await sess.snapshot();
    expect(snap.raw.origin).toBe("http://localhost:3100");
    expect(Object.keys(snap.raw.refs)).toEqual(["e1", "e3", "e8"]);
    expect(snap.rawJson).toBe(fakeSnapshotJson);
    expect(argvLog[1]).toEqual(["--session", "run_s", "snapshot", "--json"]);
  });

  it("click @<ref> normalizes refs that already include @", async () => {
    const { spawnFn, argvLog } = buildSpawn({});
    const sess = new AgentBrowserSession({ sessionId: "run_c", spawnFn });
    await sess.open("http://localhost:3100/");
    await sess.click("e3");
    await sess.click("@e8");
    expect(argvLog[1]).toEqual(["--session", "run_c", "click", "@e3"]);
    expect(argvLog[2]).toEqual(["--session", "run_c", "click", "@e8"]);
  });

  it("fill @<ref> '<text>' passes the text verbatim", async () => {
    const { spawnFn, argvLog } = buildSpawn({});
    const sess = new AgentBrowserSession({ sessionId: "run_f", spawnFn });
    await sess.open("http://localhost:3100/");
    await sess.fill("e5", "WELCOME10");
    expect(argvLog[1]).toEqual(["--session", "run_f", "fill", "@e5", "WELCOME10"]);
  });

  it("scroll / back / press / screenshot all use --session prefix", async () => {
    const { spawnFn, argvLog } = buildSpawn({});
    const sess = new AgentBrowserSession({ sessionId: "run_x", spawnFn });
    await sess.open("http://localhost:3100/");
    await sess.scroll("down");
    await sess.back();
    await sess.press("Escape");
    await sess.screenshot("/tmp/shot.png");
    expect(argvLog[1]).toEqual(["--session", "run_x", "scroll", "down"]);
    expect(argvLog[2]).toEqual(["--session", "run_x", "back"]);
    expect(argvLog[3]).toEqual(["--session", "run_x", "press", "Escape"]);
    expect(argvLog[4]).toEqual(["--session", "run_x", "screenshot", "/tmp/shot.png"]);
  });

  it("close is idempotent if open never succeeded", async () => {
    const { spawnFn, argvLog } = buildSpawn({});
    const sess = new AgentBrowserSession({ sessionId: "run_idle", spawnFn });
    await sess.close();
    expect(argvLog).toHaveLength(0);
    expect(sess.isOpen).toBe(false);
  });

  it("non-zero exit on open throws with the agent-browser stderr embedded", async () => {
    const { spawnFn } = buildSpawn({
      open: { exitCode: 2, stderr: "navigation blocked: domain not allowlisted" },
    });
    const sess = new AgentBrowserSession({
      sessionId: "run_block",
      allowedDomains: ["localhost"],
      spawnFn,
    });
    await expect(sess.open("https://evil.example.test/")).rejects.toThrow(/domain not allowlisted/);
  });

  it("snapshot throws when agent-browser returns success:false", async () => {
    const { spawnFn } = buildSpawn({
      snapshot: { stdout: JSON.stringify({ success: false, error: "no active page" }) },
    });
    const sess = new AgentBrowserSession({ sessionId: "run_z", spawnFn });
    await sess.open("http://localhost:3100/");
    await expect(sess.snapshot()).rejects.toThrow(/no active page/);
  });

  it("onIO callback receives stdout/stderr per command", async () => {
    const seen: string[] = [];
    const { spawnFn } = buildSpawn({
      snapshot: { stdout: fakeSnapshotJson, stderr: "warn: cdp slow" },
    });
    const sess = new AgentBrowserSession({
      sessionId: "run_io",
      spawnFn,
      onIO: (e) => seen.push(`${e.stream}:${e.argv[2] ?? "?"}`),
    });
    await sess.open("http://localhost:3100/");
    await sess.snapshot();
    expect(seen).toContain("stdout:snapshot");
    expect(seen).toContain("stderr:snapshot");
  });

  it("close after open invokes the close subcommand once and sets isOpen=false", async () => {
    const { spawnFn, argvLog } = buildSpawn({});
    const sess = new AgentBrowserSession({ sessionId: "run_close", spawnFn });
    await sess.open("http://localhost:3100/");
    expect(sess.isOpen).toBe(true);
    await sess.close();
    expect(sess.isOpen).toBe(false);
    expect(argvLog.at(-1)).toEqual(["--session", "run_close", "close"]);
  });
});

// vi.unmock noop just to keep the import used.
vi.fn();
