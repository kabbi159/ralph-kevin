import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// File-system-backed run reader. Read-only; the web app never mutates the
// .personabench/runs/ directory — that's the runner's responsibility.

const RUNS_ROOT = resolve(process.cwd(), "..", "..", ".personabench", "runs");

export type RunSummary = {
  id: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  targetUrl: string;
  task: string;
  personaIds: string[];
  counts: { events: number; frictionSignals: number; findings: number };
  reportPath: string;
  label?: string;
  scenario?: string;
  batchId?: string;
  personaIndex?: number;
};

export const runsRoot = (): string => RUNS_ROOT;

export const listRuns = (): RunSummary[] => {
  if (!existsSync(RUNS_ROOT)) return [];
  const ids = readdirSync(RUNS_ROOT)
    .filter((id) => statSync(join(RUNS_ROOT, id)).isDirectory())
    .sort()
    .reverse();
  const out: RunSummary[] = [];
  for (const id of ids) {
    const runJson = join(RUNS_ROOT, id, "run.json");
    if (!existsSync(runJson)) continue;
    try {
      const data = JSON.parse(readFileSync(runJson, "utf8"));
      const labelPath = join(RUNS_ROOT, id, "label.json");
      let label: string | undefined;
      let scenario: string | undefined;
      if (existsSync(labelPath)) {
        try {
          const tag = JSON.parse(readFileSync(labelPath, "utf8"));
          label = tag.label;
          scenario = tag.scenario;
        } catch {
          // ignore
        }
      }
      // Heuristic scenario tagging if no explicit label.
      if (!scenario && data.config?.targetUrl) {
        const url = data.config.targetUrl as string;
        if (url.includes("crack.wrtn.ai")) scenario = "crack-live";
        else if (url.includes("localhost:3100")) scenario = "local-checkout";
        else if (url.startsWith("https://")) scenario = "external-live";
      }
      // Batch grouping
      const batchPath = join(RUNS_ROOT, id, "batch.json");
      let batchId: string | undefined;
      let personaIndex: number | undefined;
      if (existsSync(batchPath)) {
        try {
          const tag = JSON.parse(readFileSync(batchPath, "utf8"));
          batchId = tag.batchId;
          personaIndex = tag.personaIndex;
        } catch {
          // ignore
        }
      }
      out.push({
        id,
        status: data.status ?? "unknown",
        createdAt: data.createdAt ?? "",
        completedAt: data.completedAt,
        targetUrl: data.config?.targetUrl ?? "",
        task: data.config?.task ?? "",
        personaIds: data.personaIds ?? [],
        counts: data.counts ?? { events: 0, frictionSignals: 0, findings: 0 },
        reportPath: `/.personabench/runs/${id}/report.html`,
        label,
        scenario,
        batchId,
        personaIndex,
      });
    } catch {
      // skip unreadable run dir
    }
  }
  return out;
};

export const readRun = (
  id: string,
): {
  summary: RunSummary;
  findings: unknown[];
  interview: unknown;
  events: unknown[];
  personas: unknown[];
} | null => {
  const runDir = join(RUNS_ROOT, id);
  if (!existsSync(runDir)) return null;
  const runJson = join(runDir, "run.json");
  if (!existsSync(runJson)) return null;
  const summary = JSON.parse(readFileSync(runJson, "utf8"));
  const findings = existsSync(join(runDir, "findings.json"))
    ? (JSON.parse(readFileSync(join(runDir, "findings.json"), "utf8")) as unknown[])
    : [];
  const interview = existsSync(join(runDir, "interview.json"))
    ? JSON.parse(readFileSync(join(runDir, "interview.json"), "utf8"))
    : null;
  const personas = existsSync(join(runDir, "personas.json"))
    ? (JSON.parse(readFileSync(join(runDir, "personas.json"), "utf8")) as unknown[])
    : [];
  const eventsPath = join(runDir, "events.ndjson");
  const events: unknown[] = [];
  if (existsSync(eventsPath)) {
    const txt = readFileSync(eventsPath, "utf8");
    for (const line of txt.split(/\r?\n/)) {
      if (line.trim().length === 0) continue;
      try {
        events.push(JSON.parse(line));
      } catch {
        // skip
      }
    }
  }
  return {
    summary: {
      id,
      status: summary.status ?? "unknown",
      createdAt: summary.createdAt ?? "",
      completedAt: summary.completedAt,
      targetUrl: summary.config?.targetUrl ?? "",
      task: summary.config?.task ?? "",
      personaIds: summary.personaIds ?? [],
      counts: summary.counts ?? { events: 0, frictionSignals: 0, findings: 0 },
      reportPath: `/.personabench/runs/${id}/report.html`,
    },
    findings,
    interview,
    events,
    personas,
  };
};
