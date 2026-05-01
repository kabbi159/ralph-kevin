#!/usr/bin/env -S tsx
// Reads .ralph/prd.json + .ralph/tasks/*.json + .ralph/status.json,
// picks the lowest-id pending task whose dependencies are all completed,
// and writes its id back to status.json.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const ralph = join(root, ".ralph");

type Task = {
  id: string;
  phase: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "blocked" | "skipped";
  pattern: "A" | "B" | "C" | "D";
  depends: string[];
};

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

const status = loadJson<{ currentTaskId: string; currentPhase: string; iteration: number }>(
  join(ralph, "status.json"),
);

const taskDir = join(ralph, "tasks");
const tasks: Task[] = readdirSync(taskDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => loadJson<Task>(join(taskDir, f)));

const byId = new Map(tasks.map((t) => [t.id, t]));

const isReady = (t: Task) =>
  t.status === "pending" &&
  t.depends.every((d) => {
    const s = byId.get(d)?.status;
    return s === "completed" || s === "skipped";
  });

const ready = tasks.filter(isReady).sort((a, b) => a.id.localeCompare(b.id));

if (ready.length === 0) {
  const inProgress = tasks.find((t) => t.status === "in_progress");
  if (inProgress) {
    process.stdout.write(`${JSON.stringify({ pick: inProgress.id, note: "still in_progress" })}\n`);
    process.exit(0);
  }
  process.stdout.write(`${JSON.stringify({ pick: null, note: "no pending tasks ready" })}\n`);
  process.exit(0);
}

const picked = ready[0];
if (!picked) {
  process.stdout.write(`${JSON.stringify({ pick: null, note: "no candidate after sort" })}\n`);
  process.exit(0);
}
const newStatus = {
  ...status,
  currentTaskId: picked.id,
  currentPhase: picked.phase,
};
writeFileSync(join(ralph, "status.json"), `${JSON.stringify(newStatus, null, 2)}\n`);
process.stdout.write(
  `${JSON.stringify({
    pick: picked.id,
    phase: picked.phase,
    title: picked.title,
    pattern: picked.pattern,
  })}\n`,
);
