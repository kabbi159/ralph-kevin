#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareCommand } from "./compare-command";
import { installCommand, uninstallCommand } from "./install-command";
import { runBatchCommand, runCommand } from "./run-command";

const args = process.argv.slice(2);
const cmd = args[0] ?? "help";

const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  if (typeof v !== "string" || v.startsWith("--")) return undefined;
  return v;
};

const hasFlag = (name: string): boolean => args.includes(name);

const printHelp = (): void => {
  console.log(`personabench — data-grounded persona UX testing CLI

Usage:
  personabench <command> [options]

Commands:
  run --config <path> [--mode scripted|scripted-postfix|scripted-multi|live]
                          [--count N]
                          Run a UX test from a config file. --count N
                          produces a multi-persona batch (mode forced
                          to scripted-multi). Default mode is scripted.
  report --run <runId>    Re-render report.html for an existing run dir.
  compare <runIdA> <runIdB>
                          Render compare-<a>.html into <b>'s run dir.
  demo                    One-command demo (scripted mode against
                          examples/run-config.checkout.json).
  mcp                     Launch the MCP server (stub; stretch S5).
  install [--codex] [--dry-run]
                          Register CLI globally + add mcpServers entry +
                          symlink claude-code plugin (G4).
  uninstall [--dry-run]   Reverse install.
  --version               Print version.
  --help                  Print this message.
`);
};

const main = async (): Promise<void> => {
  if (cmd === "--version" || cmd === "-v") {
    console.log("personabench 0.1.0");
    return;
  }
  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    return;
  }

  if (cmd === "run") {
    const configPath = flag("--config");
    if (!configPath) {
      console.error("personabench run: --config <path> is required");
      process.exit(2);
    }
    const countStr = flag("--count");
    const count = countStr ? Number.parseInt(countStr, 10) : 1;
    if (count > 1) {
      const batch = await runBatchCommand({
        configPath,
        mode: "scripted-multi",
        count,
      });
      console.log(`batch:     ${batch.batchId} · ${batch.runs.length} personas`);
      for (const p of batch.perPersonaSummary) {
        const sevs = p.severities.length > 0 ? `[${p.severities.join(",")}]` : "[]";
        console.log(
          `  ${p.personaId.padEnd(32)} signals=${String(p.signals).padEnd(2)} findings=${String(p.findings).padEnd(2)} ${sevs}`,
        );
      }
      const last = batch.runs.at(-1);
      if (last) console.log(`last report: file://${last.reportPath}`);
      return;
    }
    const mode = (flag("--mode") ?? "scripted") as
      | "scripted"
      | "scripted-postfix"
      | "scripted-multi"
      | "live";
    const lang = (flag("--lang") ?? "auto") as "ko" | "en" | "auto";
    const result = await runCommand({ configPath, mode, lang });
    console.log(`run id:    ${result.runId}`);
    console.log(`run dir:   ${result.runDir}`);
    console.log(`signals:   ${result.signalCount}`);
    console.log(`findings:  ${result.findings.length}`);
    console.log(`report:    file://${result.reportPath}`);
    return;
  }

  if (cmd === "report") {
    const runId = flag("--run");
    if (!runId) {
      console.error("personabench report: --run <runId> is required");
      process.exit(2);
    }
    const reportPath = resolve(".personabench", "runs", runId, "report.html");
    if (!existsSync(reportPath)) {
      console.error(
        `personabench report: ${reportPath} does not exist. Run \`personabench run\` first.`,
      );
      process.exit(2);
    }
    console.log(`file://${reportPath}`);
    return;
  }

  if (cmd === "compare") {
    const a = args[1];
    const b = args[2];
    if (!a || !b) {
      console.error("personabench compare <runIdA> <runIdB>");
      process.exit(2);
    }
    const r = compareCommand({ runIdA: a, runIdB: b });
    console.log(`resolved:  ${r.resolvedFindings.length}`);
    console.log(`new:       ${r.newFindings.length}`);
    console.log(`compare:   file://${r.comparePath}`);
    return;
  }

  if (cmd === "mcp") {
    if (hasFlag("--help") || hasFlag("-h")) {
      console.log(
        "personabench mcp — start the MCP stdio server. Tools: run_persona_ux_test, get_ux_findings, get_replay_link, generate_fix_prompt, list_runs.",
      );
      return;
    }
    const { startStdioServer } = await import("@personabench/mcp-server");
    const { writeFileSync } = await import("node:fs");
    // CLI wires its own runExecutor — calls runCommand via a synthesized
    // RunConfig at /tmp. Decouples mcp-server from the CLI package.
    await startStdioServer({
      runExecutor: async (input) => {
        const cfg = {
          targetUrl: input.targetUrl,
          task: input.task,
          successCriteria: input.successCriteria,
          limits: { maxDurationSec: input.maxDurationSec ?? 180, maxActions: 30 },
          safety: {
            allowedDomains: [new URL(input.targetUrl).hostname],
            blockPaymentSubmission: true,
            blockDestructiveActions: true,
            redactSensitiveFields: true,
          },
          artifacts: { screenshots: true, video: false, trace: false, rrweb: false },
        };
        const tmp = `/tmp/personabench-mcp-${Date.now()}.json`;
        writeFileSync(tmp, JSON.stringify(cfg));
        const r = await runCommand({ configPath: tmp, mode: "scripted" });
        return {
          runId: r.runId,
          runDir: r.runDir,
          reportPath: r.reportPath,
          signalCount: r.signalCount,
          findingCount: r.findings.length,
        };
      },
    });
    return;
  }

  if (cmd === "install") {
    const result = installCommand({
      dryRun: hasFlag("--dry-run"),
      codex: hasFlag("--codex"),
    });
    for (const step of result.steps) console.log(`  ✓ ${step}`);
    for (const warn of result.warnings) console.error(`  ⚠ ${warn}`);
    return;
  }

  if (cmd === "uninstall") {
    const result = uninstallCommand({ dryRun: hasFlag("--dry-run") });
    for (const step of result.steps) console.log(`  ✓ ${step}`);
    for (const warn of result.warnings) console.error(`  ⚠ ${warn}`);
    return;
  }

  if (cmd === "demo") {
    // Drive the scripted demo end-to-end. ≤2 minute target.
    const here = dirname(fileURLToPath(import.meta.url));
    // CLI installed to dist/ runs from packages/cli/dist/bin.js → repo root is 4 up.
    // CLI run via tsx runs from packages/cli/src/bin.ts → repo root is 4 up.
    const repoRoot = resolve(here, "..", "..", "..");
    const configPath = resolve(repoRoot, "examples", "run-config.checkout.json");
    if (!existsSync(configPath)) {
      console.error(`personabench demo: example config not found at ${configPath}`);
      process.exit(2);
    }
    console.log("▶ personabench demo — scripted mode");
    const r1 = await runCommand({ configPath, mode: "scripted" });
    console.log(`  run A: ${r1.runId} (${r1.signalCount} signals, ${r1.findings.length} findings)`);

    console.log("▶ scripted post-fix run (G2 compare)");
    const r2 = await runCommand({ configPath, mode: "scripted-postfix" });
    console.log(`  run B: ${r2.runId} (${r2.signalCount} signals, ${r2.findings.length} findings)`);

    const cmp = compareCommand({ runIdA: r1.runId, runIdB: r2.runId });
    console.log(
      `▶ compare → resolved=${cmp.resolvedFindings.length} new=${cmp.newFindings.length}`,
    );
    console.log(`▶ report:  file://${r1.reportPath}`);
    console.log(`▶ compare: file://${cmp.comparePath}`);
    return;
  }

  console.error(`personabench: unknown command "${cmd}". Try \`personabench --help\`.`);
  process.exit(2);
};

main().catch((err) => {
  console.error(`personabench: ${(err as Error).message}`);
  process.exit(1);
});
