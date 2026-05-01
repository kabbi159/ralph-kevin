import { z } from "zod";

// UXFinding — see docs/04_RUNNER_ANALYZER_SPEC.md §Finding generation.
// A finding aggregates related FrictionSignals and must always cite behavioral
// evidence (eventIds + screenshots) so the report can never hallucinate a
// problem the agent did not actually observe.

export const UXFindingSeveritySchema = z.enum(["low", "medium", "high", "critical"]);

export const UXFindingPersonaRefSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
});

export const UXFindingEvidenceSchema = z.object({
  timestamps: z.array(z.string()),
  eventIds: z.array(z.string().min(1)).min(1),
  frictionSignalIds: z.array(z.string().min(1)).min(1),
  screenshots: z.array(z.string()).optional(),
  videoPath: z.string().optional(),
  tracePath: z.string().optional(),
  replayPath: z.string().optional(),
});

export const UXFindingDiagnosisSchema = z.object({
  userGoal: z.string().min(1),
  observedBehavior: z.string().min(1),
  likelyCause: z.string().min(1),
  // confidence is on a 0-1 scale per spec (see also report.html confidence dot)
  confidence: z.number().min(0).max(1),
});

export const UXFindingRecommendationSchema = z.object({
  uxChange: z.string().min(1),
  implementationHint: z.string().optional(),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
});

export const UXFindingSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  severity: UXFindingSeveritySchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  persona: UXFindingPersonaRefSchema,
  evidence: UXFindingEvidenceSchema,
  diagnosis: UXFindingDiagnosisSchema,
  recommendation: UXFindingRecommendationSchema,
  codingAgentPrompt: z.string().min(1),
});

export type UXFindingSeverity = z.infer<typeof UXFindingSeveritySchema>;
export type UXFinding = z.infer<typeof UXFindingSchema>;
