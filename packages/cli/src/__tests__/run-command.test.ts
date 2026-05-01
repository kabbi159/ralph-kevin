import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compareCommand } from "../compare-command";
import { runCommand } from "../run-command";

const REPO_ROOT = "/Users/kevin/ralph-kevin";
const CHECKOUT_CONFIG = join(REPO_ROOT, "examples", "run-config.checkout.json");

describe("runCommand (scripted)", () => {
  it("produces a complete run dir with all required artifacts (G1 baseline)", async () => {
    const runsRoot = mkdtempSync(join(tmpdir(), "personabench-cli-"));
    try {
      const r = await runCommand({
        configPath: CHECKOUT_CONFIG,
        runsRoot,
        mode: "scripted",
      });

      // G1: ≥3 friction signals, ≥1 high finding
      expect(r.signalCount).toBeGreaterThanOrEqual(3);
      const highOrCritical = r.findings.filter(
        (f) => f.severity === "high" || f.severity === "critical",
      );
      expect(highOrCritical.length).toBeGreaterThanOrEqual(1);

      // Artifact set per docs/02 §Storage layout
      expect(existsSync(join(r.runDir, "run.json"))).toBe(true);
      expect(existsSync(join(r.runDir, "personas.json"))).toBe(true);
      expect(existsSync(join(r.runDir, "events.ndjson"))).toBe(true);
      expect(existsSync(join(r.runDir, "friction-signals.json"))).toBe(true);
      expect(existsSync(join(r.runDir, "findings.json"))).toBe(true);
      expect(existsSync(join(r.runDir, "interview.md"))).toBe(true);
      expect(existsSync(join(r.runDir, "interview.json"))).toBe(true);
      expect(existsSync(join(r.runDir, "report.html"))).toBe(true);
      expect(existsSync(join(r.runDir, "fix-prompts", "F-001.md"))).toBe(true);

      // report.html is self-contained — no external script/style URLs
      const html = readFileSync(r.reportPath, "utf8");
      expect(html).toContain("PersonaBench");
      expect(html).toContain("F-001");
      expect(html).not.toMatch(/<script[^>]+src="https?:/);
      expect(html).not.toMatch(/<link[^>]+href="https?:.+\.css/);

      // ≥1 finding has evidence (eventIds + screenshotPaths)
      const withEvidence = r.findings.find(
        (f) => f.evidence.eventIds.length > 0 && (f.evidence.screenshots?.length ?? 0) > 0,
      );
      expect(withEvidence).toBeDefined();
    } finally {
      rmSync(runsRoot, { recursive: true, force: true });
    }
  }, 30_000);

  it("compare(A, B) marks all A findings as resolved when B is the post-fix run (G2)", async () => {
    const runsRoot = mkdtempSync(join(tmpdir(), "personabench-cli-cmp-"));
    try {
      const a = await runCommand({
        configPath: CHECKOUT_CONFIG,
        runsRoot,
        mode: "scripted",
      });
      const b = await runCommand({
        configPath: CHECKOUT_CONFIG,
        runsRoot,
        mode: "scripted-postfix",
      });
      const cmp = compareCommand({
        runIdA: a.runId,
        runIdB: b.runId,
        runsRoot,
      });
      expect(cmp.resolvedFindings.length).toBe(a.findings.length);
      expect(cmp.newFindings.length).toBe(0);
      expect(existsSync(cmp.comparePath)).toBe(true);
      const cmpHtml = readFileSync(cmp.comparePath, "utf8");
      expect(cmpHtml).toContain("Resolved");
      expect(cmpHtml).toContain("New");
    } finally {
      rmSync(runsRoot, { recursive: true, force: true });
    }
  }, 30_000);

  it("rejects an invalid config path", async () => {
    await expect(
      runCommand({
        configPath: "/no/such/run-config.json",
        runsRoot: "/tmp/personabench-cli-reject",
      }),
    ).rejects.toThrow(/config file not found/);
  });

  it("--mode live throws (deferred per spec-changes.md)", async () => {
    const runsRoot = mkdtempSync(join(tmpdir(), "personabench-cli-live-"));
    try {
      await expect(
        runCommand({ configPath: CHECKOUT_CONFIG, runsRoot, mode: "live" }),
      ).rejects.toThrow(/deferred/);
    } finally {
      rmSync(runsRoot, { recursive: true, force: true });
    }
  });
});
