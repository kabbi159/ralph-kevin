import { z } from "zod";

// FrictionSignal — see docs/04_RUNNER_ANALYZER_SPEC.md §Friction signals.
// One signal per detected friction occurrence. The analyzer aggregates these
// into UXFindings (1..N signals → one finding when they share a root cause).

export const FrictionSignalTypeSchema = z.enum([
  "long_hesitation",
  "repeated_click",
  "dead_click",
  "backtrack",
  "form_error",
  "scroll_search",
  "task_abandonment",
  "cta_not_found",
  "copy_confusion",
  "price_uncertainty",
  "trust_uncertainty",
]);

export const FrictionSeverityHintSchema = z.enum(["low", "medium", "high"]);

export const FrictionEvidenceSchema = z.object({
  eventIds: z.array(z.string().min(1)).min(1),
  screenshotPaths: z.array(z.string()).optional(),
  notes: z.string(),
});

export const FrictionSignalSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  personaId: z.string().min(1),
  type: FrictionSignalTypeSchema,
  severityHint: FrictionSeverityHintSchema,
  timestampStartMs: z.number().int().nonnegative(),
  timestampEndMs: z.number().int().nonnegative().optional(),
  evidence: FrictionEvidenceSchema,
});

export type FrictionSignalType = z.infer<typeof FrictionSignalTypeSchema>;
export type FrictionSeverityHint = z.infer<typeof FrictionSeverityHintSchema>;
export type FrictionEvidence = z.infer<typeof FrictionEvidenceSchema>;
export type FrictionSignal = z.infer<typeof FrictionSignalSchema>;
