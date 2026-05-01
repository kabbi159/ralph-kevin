import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

// Clone-and-install distribution per boot prompt §G4. Idempotent install +
// reversible uninstall: register the CLI globally, add an mcpServers entry
// to ~/.claude/settings.json, symlink the claude-code plugin into
// ~/.claude/plugins/personabench. The Codex skill is opt-in via --codex.

export type InstallOpts = {
  // Repo root (where pnpm-workspace.yaml lives). Defaults to the directory
  // containing the running CLI (3 levels up from packages/cli/dist/bin.js
  // OR packages/cli/src/bin.ts).
  repoRoot?: string;
  // Override the Claude home — tests pass a temp dir; production uses ~/.claude.
  claudeHome?: string;
  // Skip the actual mutations (pnpm link, settings.json edit, symlink) and
  // just print what would happen. Used by tests + CI.
  dryRun?: boolean;
  // Also link the Codex skill (off by default).
  codex?: boolean;
};

export type InstallResult = {
  steps: string[];
  warnings: string[];
};

const SETTINGS_KEY = "personabench";

const claudeSettingsPath = (claudeHome: string): string => join(claudeHome, "settings.json");

const claudePluginsDir = (claudeHome: string): string => join(claudeHome, "plugins");

const readJsonOrEmpty = (path: string): Record<string, unknown> => {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const writeJson = (path: string, data: unknown): void => {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
};

const safeSymlink = (target: string, linkPath: string): { created: boolean; replaced: boolean } => {
  const dir = resolve(linkPath, "..");
  mkdirSync(dir, { recursive: true });
  let replaced = false;
  if (
    existsSync(linkPath) ||
    (() => {
      try {
        lstatSync(linkPath);
        return true;
      } catch {
        return false;
      }
    })()
  ) {
    try {
      unlinkSync(linkPath);
      replaced = true;
    } catch {
      // best-effort
    }
  }
  symlinkSync(target, linkPath);
  return { created: true, replaced };
};

export const installCommand = (opts: InstallOpts = {}): InstallResult => {
  const repoRoot = resolve(opts.repoRoot ?? process.cwd());
  const claudeHome = resolve(opts.claudeHome ?? join(homedir(), ".claude"));
  const dryRun = opts.dryRun === true;
  const steps: string[] = [];
  const warnings: string[] = [];

  // 1. Verify repo root has pnpm-workspace.yaml — fail loud if the user
  //    invoked `personabench install` from a clone that doesn't look right.
  if (!existsSync(join(repoRoot, "pnpm-workspace.yaml"))) {
    throw new Error(
      `personabench install: repo root does not contain pnpm-workspace.yaml at ${repoRoot}. Run from inside a PersonaBench clone or pass --repo-root.`,
    );
  }

  // 2. pnpm link --global the CLI package.
  steps.push(`pnpm link --global @personabench/cli (from ${join(repoRoot, "packages/cli")})`);
  if (!dryRun) {
    const r = spawnSync("pnpm", ["-F", "@personabench/cli", "link", "--global"], {
      cwd: repoRoot,
      stdio: "pipe",
      encoding: "utf8",
    });
    if (r.status !== 0) {
      warnings.push(
        `pnpm link --global exited ${r.status}; CLI may not be on PATH. stderr: ${r.stderr.trim()}`,
      );
    }
  }

  // 3. Add idempotent mcpServers.personabench entry to ~/.claude/settings.json.
  const settingsPath = claudeSettingsPath(claudeHome);
  const settings = readJsonOrEmpty(settingsPath);
  const mcpServers = (settings.mcpServers as Record<string, unknown> | undefined) ?? {};
  const beforeKey = Object.keys(mcpServers).includes(SETTINGS_KEY);
  mcpServers[SETTINGS_KEY] = { command: "personabench", args: ["mcp"] };
  settings.mcpServers = mcpServers;
  steps.push(`${beforeKey ? "update" : "add"} mcpServers.${SETTINGS_KEY} in ${settingsPath}`);
  if (!dryRun) {
    writeJson(settingsPath, settings);
  }

  // 4. Symlink the claude-code plugin into ~/.claude/plugins/personabench.
  const pluginSource = join(repoRoot, "plugins", "claude-code");
  const pluginLink = join(claudePluginsDir(claudeHome), "personabench");
  if (existsSync(pluginSource)) {
    steps.push(`symlink ${pluginSource} → ${pluginLink}`);
    if (!dryRun) safeSymlink(pluginSource, pluginLink);
  } else {
    warnings.push(
      `plugins/claude-code does not exist at ${pluginSource}; skipping plugin symlink.`,
    );
  }

  // 5. Codex skill (opt-in).
  if (opts.codex) {
    const codexSource = join(repoRoot, "plugins", "codex-skill");
    const codexLink = join(claudeHome, "codex-skills", "personabench");
    if (existsSync(codexSource)) {
      steps.push(`symlink ${codexSource} → ${codexLink}`);
      if (!dryRun) safeSymlink(codexSource, codexLink);
    } else {
      warnings.push("plugins/codex-skill does not exist; skipping --codex linkage.");
    }
  }

  return { steps, warnings };
};

export const uninstallCommand = (opts: InstallOpts = {}): InstallResult => {
  const repoRoot = resolve(opts.repoRoot ?? process.cwd());
  const claudeHome = resolve(opts.claudeHome ?? join(homedir(), ".claude"));
  const dryRun = opts.dryRun === true;
  const steps: string[] = [];
  const warnings: string[] = [];

  // 1. pnpm unlink --global.
  steps.push("pnpm unlink --global @personabench/cli");
  if (!dryRun) {
    const r = spawnSync("pnpm", ["-F", "@personabench/cli", "unlink", "--global"], {
      cwd: repoRoot,
      stdio: "pipe",
      encoding: "utf8",
    });
    if (r.status !== 0) {
      warnings.push(`pnpm unlink --global exited ${r.status}: ${r.stderr.trim()}`);
    }
  }

  // 2. Remove mcpServers entry.
  const settingsPath = claudeSettingsPath(claudeHome);
  if (existsSync(settingsPath)) {
    const settings = readJsonOrEmpty(settingsPath);
    const mcpServers = settings.mcpServers as Record<string, unknown> | undefined;
    if (mcpServers && SETTINGS_KEY in mcpServers) {
      const { [SETTINGS_KEY]: _removed, ...rest } = mcpServers;
      steps.push(`remove mcpServers.${SETTINGS_KEY} from ${settingsPath}`);
      if (!dryRun) {
        if (Object.keys(rest).length === 0) {
          const { mcpServers: _ms, ...restSettings } = settings;
          writeJson(settingsPath, restSettings);
        } else {
          writeJson(settingsPath, { ...settings, mcpServers: rest });
        }
      }
    } else {
      steps.push(`mcpServers.${SETTINGS_KEY} not present — nothing to remove`);
    }
  }

  // 3. Remove plugin symlink.
  const pluginLink = join(claudePluginsDir(claudeHome), "personabench");
  try {
    const stat = lstatSync(pluginLink);
    if (stat.isSymbolicLink() || stat.isFile() || stat.isDirectory()) {
      steps.push(`remove ${pluginLink}`);
      if (!dryRun) unlinkSync(pluginLink);
    }
  } catch {
    // not present
  }

  // 4. Remove codex skill link if present.
  const codexLink = join(claudeHome, "codex-skills", "personabench");
  try {
    lstatSync(codexLink);
    steps.push(`remove ${codexLink}`);
    if (!dryRun) unlinkSync(codexLink);
  } catch {
    // not present
  }

  return { steps, warnings };
};

// Tiny helper used by the verification scenario in tests + the docs:
// `personabench --version` / `--help` / `run --help` should always exit 0
// once installed. We don't actually re-shell from here — those paths are
// covered by the bin.ts router.

export const isInstalled = (claudeHome: string = join(homedir(), ".claude")): boolean => {
  const settings = readJsonOrEmpty(claudeSettingsPath(claudeHome));
  const mcpServers = settings.mcpServers as Record<string, unknown> | undefined;
  return Boolean(mcpServers && SETTINGS_KEY in mcpServers);
};

export const listInstalledArtifacts = (
  claudeHome: string = join(homedir(), ".claude"),
): Array<string> => {
  const out: string[] = [];
  if (existsSync(claudeSettingsPath(claudeHome))) {
    out.push(claudeSettingsPath(claudeHome));
  }
  const pluginsDir = claudePluginsDir(claudeHome);
  if (existsSync(pluginsDir)) {
    for (const entry of readdirSync(pluginsDir)) {
      if (entry === "personabench") out.push(join(pluginsDir, entry));
    }
  }
  return out;
};
