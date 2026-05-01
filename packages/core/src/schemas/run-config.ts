import { z } from "zod";
import { PersonaSearchQuerySchema } from "./persona-search-query";

// RunConfig — see docs/04_RUNNER_ANALYZER_SPEC.md §Run config (with the
// personaQuery type fixed in .ralph/spec-changes.md to be a structured query
// object, matching every actual usage in docs/06 and examples/run-config.*.json).
//
// `id` is optional in this schema because the example JSONs ship without one;
// the CLI assigns a runId before persisting `run.json` into
// `.personabench/runs/<runId>/`.

export const ViewportSchema = z.object({
  name: z.enum(["mobile", "desktop"]),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const RunLimitsSchema = z.object({
  maxDurationSec: z.number().int().positive(),
  maxActions: z.number().int().positive(),
});

export const RunSafetySchema = z.object({
  allowedDomains: z.array(z.string().min(1)),
  blockPaymentSubmission: z.boolean(),
  blockDestructiveActions: z.boolean(),
  redactSensitiveFields: z.boolean(),
});

export const RunArtifactsToggleSchema = z.object({
  screenshots: z.boolean(),
  video: z.boolean(),
  trace: z.boolean(),
  rrweb: z.boolean(),
});

export const RunConfigSchema = z.object({
  id: z.string().optional(),
  projectId: z.string().optional(),
  targetUrl: z.string().url(),
  task: z.string().min(1),
  successCriteria: z.array(z.string()).optional(),
  personaSource: z.string().optional(),
  personaQuery: PersonaSearchQuerySchema.optional(),
  personaIds: z.array(z.string()).optional(),
  personaPackId: z.string().optional(),
  sampleSize: z.number().int().positive().optional(),
  viewport: ViewportSchema.optional(),
  limits: RunLimitsSchema,
  safety: RunSafetySchema,
  artifacts: RunArtifactsToggleSchema,
});

export type Viewport = z.infer<typeof ViewportSchema>;
export type RunLimits = z.infer<typeof RunLimitsSchema>;
export type RunSafety = z.infer<typeof RunSafetySchema>;
export type RunArtifactsToggle = z.infer<typeof RunArtifactsToggleSchema>;
export type RunConfig = z.infer<typeof RunConfigSchema>;

// A persisted Run is a hydrated RunConfig with an assigned id, a status, and
// an evolving event/finding count surfaced to the dashboard.
export const RunStatusSchema = z.enum([
  "queued",
  "pending",
  "in_progress",
  "completed",
  "failed",
  "stopped",
]);

export const RunSchema = z.object({
  id: z.string().min(1),
  config: RunConfigSchema,
  status: RunStatusSchema,
  createdAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  failureReason: z.string().optional(),
  personaIds: z.array(z.string()).default([]),
  counts: z
    .object({
      events: z.number().int().nonnegative().default(0),
      frictionSignals: z.number().int().nonnegative().default(0),
      findings: z.number().int().nonnegative().default(0),
    })
    .default({ events: 0, frictionSignals: 0, findings: 0 }),
});

export type RunStatus = z.infer<typeof RunStatusSchema>;
export type Run = z.infer<typeof RunSchema>;
