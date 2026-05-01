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
import { buildPersonaConditionedEvents } from "./persona-variance";
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
  mode?: "scripted" | "scripted-postfix" | "live" | "scripted-multi";
  runsRoot?: string;
  // Override the default persona source (used by tests).
  personaIdOverride?: string;
  // For scripted-multi: how many personas to run. Default 3.
  count?: number;
  // Output language for findings + interview + report. Defaults to 'ko'
  // (Korean) for the verified persona dataset; 'auto' infers from
  // persona.locale.language; 'en' forces English.
  lang?: "ko" | "en" | "auto";
};

export type RunCommandResult = {
  runId: string;
  runDir: string;
  reportPath: string;
  findings: UXFinding[];
  signalCount: number;
};

export type RunBatchResult = {
  batchId: string;
  runs: RunCommandResult[];
  perPersonaSummary: Array<{
    personaId: string;
    displayName: string;
    signals: number;
    findings: number;
    severities: string[];
  }>;
};

const findFirstMockMatching = (config: RunConfig) => {
  const src = new MockPersonaSource();
  if (config.personaQuery) {
    return src.search(config.personaQuery).then((r) => r.matches[0] ?? MOCK_FIXTURES[0]);
  }
  return Promise.resolve(MOCK_FIXTURES[0]);
};

const pickMultipleMockPersonas = async (
  config: RunConfig,
  count: number,
): Promise<(typeof MOCK_FIXTURES)[number][]> => {
  const src = new MockPersonaSource();
  const matches = config.personaQuery
    ? (await src.search(config.personaQuery)).matches
    : [...MOCK_FIXTURES];
  const out = matches.slice(0, count);
  // Top up from the full fixture pool if the query under-resolved.
  for (const fixture of MOCK_FIXTURES) {
    if (out.length >= count) break;
    if (!out.some((p) => p.id === fixture.id)) out.push(fixture);
  }
  return out.slice(0, count);
};

export const runBatchCommand = async (opts: RunCommandOpts): Promise<RunBatchResult> => {
  const count = opts.count ?? 3;
  const configPath = resolve(opts.configPath);
  const runsRoot = opts.runsRoot ?? resolve(".personabench", "runs");
  const rawConfig = JSON.parse(readFileSync(configPath, "utf8"));
  const config = RunConfigSchema.parse(rawConfig);
  const personas = await pickMultipleMockPersonas(config, count);
  const batchId = newRunId();
  const runs: RunCommandResult[] = [];
  const perPersona: RunBatchResult["perPersonaSummary"] = [];
  // Honor an explicit mode (live | scripted-multi). When the caller passed
  // mode: "live" via runBatchCommand we drive each persona through a real
  // agent-browser session in turn. Scripted-multi is the fast deterministic
  // fallback.
  const inheritedMode = opts.mode === "live" ? "live" : "scripted-multi";
  for (const personaRecord of personas) {
    const r = await runCommand({
      ...opts,
      mode: inheritedMode,
      runsRoot,
      personaIdOverride: personaRecord.id,
    });
    runs.push(r);
    perPersona.push({
      personaId: personaRecord.id,
      displayName: `${personaRecord.demographics.age ?? "?"} ${personaRecord.demographics.occupation ?? "?"}`,
      signals: r.signalCount,
      findings: r.findings.length,
      severities: r.findings.map((f) => f.severity),
    });
    // Stamp every run with a batch.json so the dashboard can group them.
    try {
      const fs = await import("node:fs");
      fs.writeFileSync(
        join(r.runDir, "batch.json"),
        JSON.stringify({ batchId, personaIndex: runs.length - 1, totalPersonas: personas.length }, null, 2),
      );
    } catch {
      // best-effort; batch grouping degrades gracefully
    }
  }
  return { batchId, runs, perPersonaSummary: perPersona };
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
  const overrideId = opts.personaIdOverride;
  const personaRecord =
    (overrideId
      ? MOCK_FIXTURES.find((p) => p.id === overrideId)
      : await findFirstMockMatching(config)) ?? MOCK_FIXTURES[0];
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
  const eventsPath = join(runDir, "events.ndjson");
  const sink = createFileEventSink(eventsPath);
  const events: import("@personabench/core").RunEvent[] = [];

  if (mode === "live") {
    // Real agent-browser drive. Spawn a session, run the observe→decide→act
    // loop with ClaudeDecisionProvider, persist every RunEvent to disk AND
    // capture in `events` so the analyzer can run on the resulting log.
    const { AgentBrowserSession, ClaudeDecisionProvider, runPersonaTest } = await import(
      "@personabench/runner"
    );
    const sessionId = runId.replace(/[^a-z0-9_-]/gi, "_");
    const browser = new AgentBrowserSession({
      sessionId,
      allowedDomains: config.safety.allowedDomains,
      viewport: config.viewport
        ? { width: config.viewport.width, height: config.viewport.height }
        : "mobile",
    });
    const provider = new ClaudeDecisionProvider();
    const dualSink = (ev: import("@personabench/core").RunEvent): void => {
      events.push(ev);
      sink(ev);
    };
    await runPersonaTest({
      runId,
      personaProfile: persona,
      config,
      decisionProvider: provider,
      browser,
      runDir,
      eventSink: dualSink,
    });
  } else {
    const scripted =
      mode === "scripted-postfix"
        ? buildCheckoutPostFixEvents(runId, persona.personaId, startedAt)
        : mode === "scripted"
          ? buildCheckoutScriptedEvents(runId, persona.personaId, startedAt)
          : buildPersonaConditionedEvents(personaRecord, runId, startedAt);
    for (const ev of scripted) {
      events.push(ev);
      sink(ev);
    }
  }

  // 4. Detectors → friction-signals.json.
  const signals = runDetectors(events, { runId, personaId: persona.personaId });
  writeFileSync(join(runDir, "friction-signals.json"), JSON.stringify(signals, null, 2));

  // 5. Aggregate → findings.json (+ fix-prompts/F-NNN.md).
  const optsLang = opts.lang;
  const resolvedLang: "ko" | "en" =
    optsLang === "ko" || optsLang === "en"
      ? optsLang
      : personaRecord.locale.language === "en"
        ? "en"
        : "ko";
  const findings = aggregateFindings({
    signals,
    events,
    persona,
    runId,
    targetUrl: config.targetUrl,
    task: config.task,
    lang: resolvedLang,
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
