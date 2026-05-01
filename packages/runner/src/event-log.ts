import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { type RunEvent, RunEventSchema } from "@personabench/core";

// Append-only NDJSON writer for events.ndjson. Each event is Zod-validated
// before serialization so a bug in the producer surfaces as a thrown error
// (and an in-memory event drop) rather than a corrupt log file.

export type EventSink = (event: RunEvent) => void;

export const createFileEventSink = (path: string): EventSink => {
  mkdirSync(dirname(path), { recursive: true });
  return (event) => {
    const validated = RunEventSchema.parse(event);
    appendFileSync(path, `${JSON.stringify(validated)}\n`, "utf8");
  };
};

export const createMemoryEventSink = (
  out: RunEvent[] = [],
): { sink: EventSink; events: RunEvent[] } => {
  const sink: EventSink = (event) => {
    out.push(RunEventSchema.parse(event));
  };
  return { sink, events: out };
};
