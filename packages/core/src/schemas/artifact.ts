import { z } from "zod";

// Artifact — represents one persisted file under .personabench/runs/<runId>/.
// Used by the report generator and the web app's `GET /api/runs/:runId/events`
// endpoint to surface artifact references without scanning the directory each
// request.

export const ArtifactTypeSchema = z.enum([
  "screenshot",
  "trace",
  "video",
  "rrweb",
  "report",
  "compare",
  "fix_prompt",
  "interview",
]);

export const ArtifactSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  type: ArtifactTypeSchema,
  // Path is relative to `.personabench/runs/<runId>/`. Local mode uses these
  // verbatim; hosted mode resolves them through signed URLs (see docs/07).
  path: z.string().min(1),
  contentType: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  createdAt: z.string(),
  // Free-form per-type metadata. e.g. screenshot stores stepIndex, video
  // stores durationSec, fix_prompt stores findingId.
  metadata: z.record(z.unknown()).optional(),
});

export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;
export type Artifact = z.infer<typeof ArtifactSchema>;
