import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { installCommand, isInstalled, uninstallCommand } from "../install-command";

const REPO_ROOT = "/Users/kevin/ralph-kevin";

describe("installCommand (G4 dry-run path)", () => {
  it("dry-run lists the three core steps without mutating disk", () => {
    const claudeHome = mkdtempSync(join(tmpdir(), "personabench-install-"));
    try {
      const r = installCommand({
        repoRoot: REPO_ROOT,
        claudeHome,
        dryRun: true,
      });
      const steps = r.steps.join(" | ");
      expect(steps).toContain("pnpm link --global @personabench/cli");
      expect(steps).toContain("mcpServers.personabench");
      expect(steps).toContain("symlink");
      // dry-run wrote nothing
      expect(existsSync(join(claudeHome, "settings.json"))).toBe(false);
      expect(existsSync(join(claudeHome, "plugins", "personabench"))).toBe(false);
    } finally {
      rmSync(claudeHome, { recursive: true, force: true });
    }
  });

  it("non-dry-run is idempotent: running twice produces no duplicate keys", () => {
    const claudeHome = mkdtempSync(join(tmpdir(), "personabench-install-"));
    try {
      installCommand({ repoRoot: REPO_ROOT, claudeHome });
      installCommand({ repoRoot: REPO_ROOT, claudeHome });
      const settings = JSON.parse(readFileSync(join(claudeHome, "settings.json"), "utf8"));
      const keys = Object.keys(settings.mcpServers);
      expect(keys.filter((k) => k === "personabench")).toHaveLength(1);
      // plugin symlink was overwritten cleanly (still resolves)
      expect(existsSync(join(claudeHome, "plugins", "personabench"))).toBe(true);
    } finally {
      rmSync(claudeHome, { recursive: true, force: true });
    }
  });

  it("preserves other mcpServers entries when adding personabench", () => {
    const claudeHome = mkdtempSync(join(tmpdir(), "personabench-install-"));
    try {
      const settingsPath = join(claudeHome, "settings.json");
      writeFileSync(
        settingsPath,
        JSON.stringify({
          mcpServers: {
            "some-other-thing": { command: "other", args: [] },
          },
          theme: "dark",
        }),
      );
      installCommand({ repoRoot: REPO_ROOT, claudeHome });
      const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
      expect(settings.theme).toBe("dark");
      expect(settings.mcpServers["some-other-thing"]).toBeDefined();
      expect(settings.mcpServers.personabench).toEqual({
        command: "personabench",
        args: ["mcp"],
      });
    } finally {
      rmSync(claudeHome, { recursive: true, force: true });
    }
  });

  it("isInstalled returns true after install, false after uninstall", () => {
    const claudeHome = mkdtempSync(join(tmpdir(), "personabench-install-"));
    try {
      expect(isInstalled(claudeHome)).toBe(false);
      installCommand({ repoRoot: REPO_ROOT, claudeHome });
      expect(isInstalled(claudeHome)).toBe(true);
      uninstallCommand({ repoRoot: REPO_ROOT, claudeHome });
      expect(isInstalled(claudeHome)).toBe(false);
      // The plugin symlink was removed too
      expect(existsSync(join(claudeHome, "plugins", "personabench"))).toBe(false);
    } finally {
      rmSync(claudeHome, { recursive: true, force: true });
    }
  });

  it("uninstall preserves unrelated mcpServers and unrelated keys", () => {
    const claudeHome = mkdtempSync(join(tmpdir(), "personabench-install-"));
    try {
      installCommand({ repoRoot: REPO_ROOT, claudeHome });
      // sneak in an unrelated entry the user added by hand
      const settingsPath = join(claudeHome, "settings.json");
      const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
      settings.mcpServers.other = { command: "other", args: [] };
      settings.theme = "auto";
      writeFileSync(settingsPath, JSON.stringify(settings));

      uninstallCommand({ repoRoot: REPO_ROOT, claudeHome });
      const after = JSON.parse(readFileSync(settingsPath, "utf8"));
      expect(after.mcpServers.personabench).toBeUndefined();
      expect(after.mcpServers.other).toEqual({ command: "other", args: [] });
      expect(after.theme).toBe("auto");
    } finally {
      rmSync(claudeHome, { recursive: true, force: true });
    }
  });

  it("install throws if invoked from outside a PersonaBench clone", () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), "personabench-fakeroot-"));
    const claudeHome = mkdtempSync(join(tmpdir(), "personabench-install-"));
    try {
      expect(() => installCommand({ repoRoot: fakeRoot, claudeHome, dryRun: true })).toThrow(
        /pnpm-workspace/,
      );
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
      rmSync(claudeHome, { recursive: true, force: true });
    }
  });
});
