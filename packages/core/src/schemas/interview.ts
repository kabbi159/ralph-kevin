import { z } from "zod";

// Interview — see docs/04_RUNNER_ANALYZER_SPEC.md §Interview generation.
// 3-5 Q&A pairs grounded in eventIds; the analyzer's interview generator must
// never invent issues that aren't reflected in the run log.

export const InterviewQAPairSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  // Each answer cites at least one RunEvent id so the report's "Why this Q?"
  // hover can resolve back to a screenshot/timeline marker.
  eventIds: z.array(z.string().min(1)).min(1),
});

export const InterviewSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  personaId: z.string().min(1),
  qaPairs: z.array(InterviewQAPairSchema).min(3).max(5),
  summary: z.string().min(1),
  createdAt: z.string(),
});

export type InterviewQAPair = z.infer<typeof InterviewQAPairSchema>;
export type Interview = z.infer<typeof InterviewSchema>;
