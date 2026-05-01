#!/usr/bin/env -S tsx
// Updates a task file's `status` field and bumps .ralph/status.json.
// Usage: tsx scripts/ralph/update-task-status.ts <taskId> <status>
//   <status> ∈ pending | in_progress | completed | blocked | skipped

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const ralph = join(root, ".ralph");

const [, , taskId, nextStatus] = process.argv;
if (!taskId || !nextStatus) {
  console.error("usage: update-task-status.ts <taskId> <status>");
  process.exit(2);
}

const allowed = new Set(["pending", "in_progress", "completed", "blocked", "skipped"]);
if (!allowed.has(nextStatus)) {
  console.error(`status must be one of ${[...allowed].join(", ")}`);
  process.exit(2);
}

const taskPath = join(ralph, "tasks", `${taskId}.json`);
const task = JSON.parse(readFileSync(taskPath, "utf8")) as Record<string, unknown>;
task.status = nextStatus;
writeFileSync(taskPath, `${JSON.stringify(task, null, 2)}\n`);

const statusPath = join(ralph, "status.json");
const status = JSON.parse(readFileSync(statusPath, "utf8")) as Record<string, unknown>;
status.currentTaskStatus = nextStatus;
status.lastUpdatedAt = new Date().toISOString();
writeFileSync(statusPath, `${JSON.stringify(status, null, 2)}\n`);

console.log(`${taskId} → ${nextStatus}`);
