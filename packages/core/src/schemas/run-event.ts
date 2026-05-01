import { z } from "zod";
import { AgentActionSchema } from "./agent-action";

// RunEvent — see docs/04_RUNNER_ANALYZER_SPEC.md §Run event schema.
// Every observation/decision/action emits one RunEvent. events.ndjson is the
// single source of truth the analyzer + report read from.

export const BoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const InteractiveElementSchema = z.object({
  role: z.string().optional(),
  label: z.string().optional(),
  selector: z.string().optional(),
  boundingBox: BoundingBoxSchema.optional(),
});

export const ObservationSchema = z.object({
  visibleText: z.string().optional(),
  interactiveElements: z.array(InteractiveElementSchema).optional(),
});

export const RunEventResultSchema = z.object({
  urlChanged: z.boolean().optional(),
  domChanged: z.boolean().optional(),
  errorText: z.array(z.string()).optional(),
  screenshotPath: z.string().optional(),
});

export const RunEventSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  personaId: z.string().min(1),
  timestampMs: z.number().int().nonnegative(),
  stepIndex: z.number().int().nonnegative(),
  page: z.object({
    url: z.string(),
    title: z.string().optional(),
  }),
  observation: ObservationSchema.optional(),
  action: AgentActionSchema.optional(),
  result: RunEventResultSchema.optional(),
  thoughtSummary: z.string().optional(),
});

export type BoundingBox = z.infer<typeof BoundingBoxSchema>;
export type InteractiveElement = z.infer<typeof InteractiveElementSchema>;
export type Observation = z.infer<typeof ObservationSchema>;
export type RunEventResult = z.infer<typeof RunEventResultSchema>;
export type RunEvent = z.infer<typeof RunEventSchema>;
