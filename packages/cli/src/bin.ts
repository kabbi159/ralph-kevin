#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareCommand } from "./compare-command";
import { runCommand } from "./run-command";

const args = process.argv.slice(2);
const cmd = args[0] ?? "help";

const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  if (typeof v !== "string" || v.startsWith("--")) return undefined;
  return v;
};

const printHelp = (): void => {
  console.log(`personabench — data-grounded persona UX testing CLI

Usage:
  personabench <command> [options]

Commands:
  run --config <path> [--mode scripted|scripted-postfix|live]
                          Run a UX test from a config file. Default mode
                          is scripted (deterministic checkout demo).
  report --run <runId>    Re-render report.html for an existing run dir.
  compare <runIdA> <runIdB>
                          Render compare-<a>.html into <b>'s run dir.
  demo                    One-command demo (scripted mode against
                          examples/run-config.checkout.json).
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
    const mode = (flag("--mode") ?? "scripted") as "scripted" | "scripted-postfix" | "live";
    const result = await runCommand({ configPath, mode });
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
