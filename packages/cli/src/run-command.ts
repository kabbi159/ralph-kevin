import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { aggregateFindings, generateInterview, runDetectors } from "@personabench/analyzer";
import {
  type RunConfig,
  RunConfigSchema,
  type UXFinding,
  newRunId,
  nowIsoUtc,
} from "@personabench/core";
import { MOCK_FIXTURES, MockPersonaSource, compilePersona } from "@personabench/personas";
import { createFileEventSink } from "@personabench/runner";
import { renderReportHtml } from "./render-report";
import { buildCheckoutPostFixEvents, buildCheckoutScriptedEvents } from "./scripted-run";

// `personabench run --config <path> [--mode scripted|live]`
// Default mode is `scripted` — replays a deterministic checkout flow that
// exercises the example app's intentional defects and produces real events
// flowing through the real analyzer + report renderer. The `--live` mode
// (which uses AgentBrowserSession + ClaudeDecisionProvider) is wired in
// packages/runner but its full E2E is deferred per .ralph/spec-changes.md.

export type RunCommandOpts = {
  configPath: string;
  mode?: "scripted" | "scripted-postfix" | "live";
  runsRoot?: string;
  // Override the default persona source (used by tests).
  personaIdOverride?: string;
};

export type RunCommandResult = {
  runId: string;
  runDir: string;
  reportPath: string;
  findings: UXFinding[];
  signalCount: number;
};

const findFirstMockMatching = (config: RunConfig) => {
  const src = new MockPersonaSource();
  if (config.personaQuery) {
    return src.search(config.personaQuery).then((r) => r.matches[0] ?? MOCK_FIXTURES[0]);
  }
  return Promise.resolve(MOCK_FIXTURES[0]);
};

export const runCommand = async (opts: RunCommandOpts): Promise<RunCommandResult> => {
  const configPath = resolve(opts.configPath);
  const mode = opts.mode ?? "scripted";
  const runsRoot = opts.runsRoot ?? resolve(".personabench", "runs");

  if (!existsSync(configPath)) {
    throw new Error(`personabench run: config file not found: ${configPath}`);
  }
  const rawConfig = JSON.parse(readFileSync(configPath, "utf8"));
  const config = RunConfigSchema.parse(rawConfig);

  const runId = config.id ?? newRunId();
  const runDir = join(runsRoot, runId);
  mkdirSync(join(runDir, "artifacts", "screenshots"), { recursive: true });
  mkdirSync(join(runDir, "fix-prompts"), { recursive: true });

  // 1. Pick a persona (mock for the demo path).
  const personaRecord = (await findFirstMockMatching(config)) ?? MOCK_FIXTURES[0];
  if (!personaRecord) {
    throw new Error("personabench run: no persona records available");
  }
  const persona = compilePersona(personaRecord, {
    productSummary: "Korean checkout demo with intentional UX defects.",
    task: config.task,
    successCriteria: config.successCriteria,
  });

  // 2. Generate run events.
  const startedAt = Date.now();
  const events =
    mode === "scripted-postfix"
      ? buildCheckoutPostFixEvents(runId, persona.personaId, startedAt)
      : mode === "scripted"
        ? buildCheckoutScriptedEvents(runId, persona.personaId, startedAt)
        : (() => {
            throw new Error(
              "personabench run --live: end-to-end live runner deferred per .ralph/spec-changes.md (TASK-050).",
            );
          })();

  // 3. Persist events.ndjson.
  const eventsPath = join(runDir, "events.ndjson");
  const sink = createFileEventSink(eventsPath);
  for (const ev of events) sink(ev);

  // 4. Detectors → friction-signals.json.
  const signals = runDetectors(events, { runId, personaId: persona.personaId });
  writeFileSync(join(runDir, "friction-signals.json"), JSON.stringify(signals, null, 2));

  // 5. Aggregate → findings.json (+ fix-prompts/F-NNN.md).
  const findings = aggregateFindings({
    signals,
    events,
    persona,
    runId,
    targetUrl: config.targetUrl,
    task: config.task,
  });
  writeFileSync(join(runDir, "findings.json"), JSON.stringify(findings, null, 2));
  for (const f of findings) {
    writeFileSync(join(runDir, "fix-prompts", `${f.id}.md`), f.codingAgentPrompt);
  }

  // 6. Interview.
  const interview = generateInterview({ events, signals, persona, runId });
  const interviewMd = `# Interview — ${persona.displayName}\n\n## Summary\n${interview.summary}\n\n${interview.qaPairs
    .map(
      (qa, i) =>
        `## Q${i + 1}: ${qa.question}\n\n**A:** ${qa.answer}\n\nCited events: \`${qa.eventIds.join("`, `")}\``,
    )
    .join("\n\n")}\n`;
  writeFileSync(join(runDir, "interview.md"), interviewMd);
  writeFileSync(join(runDir, "interview.json"), JSON.stringify(interview, null, 2));

  // 7. personas.json + run.json summary.
  writeFileSync(join(runDir, "personas.json"), JSON.stringify([personaRecord], null, 2));
  writeFileSync(
    join(runDir, "run.json"),
    JSON.stringify(
      {
        id: runId,
        config,
        status: "completed",
        createdAt: new Date(startedAt).toISOString(),
        completedAt: nowIsoUtc(),
        personaIds: [persona.personaId],
        counts: {
          events: events.length,
          frictionSignals: signals.length,
          findings: findings.length,
        },
        mode,
      },
      null,
      2,
    ),
  );

  // 8. report.html.
  const html = renderReportHtml({
    runId,
    config,
    persona,
    events,
    findings,
    interview,
    fixPromptPaths: findings.map((f) => `fix-prompts/${f.id}.md`),
    generatedAt: nowIsoUtc(),
  });
  const reportPath = join(runDir, "report.html");
  writeFileSync(reportPath, html);

  return {
    runId,
    runDir,
    reportPath,
    findings,
    signalCount: signals.length,
  };
};
