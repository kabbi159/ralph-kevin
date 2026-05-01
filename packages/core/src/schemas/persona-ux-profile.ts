import { z } from "zod";
import { PersonaSourceSchema } from "./persona-record";

// PersonaUXProfile — see docs/03_PERSONA_DATA_LAYER.md §Persona UX profile.
// Compiled from a PersonaRecord by `PersonaCompiler` (Phase 2). The
// `promptBlock` is rendered into the runtime DecisionProvider system prompt.
//
// All four taskBehaviorInstructions are short imperatives that explicitly tell
// the persona-agent it is *not* trying to pass the test; the required system
// instruction lives in docs/03 §Required persona system instruction and must
// always be present in the rendered promptBlock.

export const PersonaUXBehaviorSchema = z.object({
  digitalConfidence: z.string().min(1),
  decisionStyle: z.string().min(1),
  likelyConcerns: z.array(z.string()),
  frictionTriggers: z.array(z.string()),
  trustSignals: z.array(z.string()),
  completionStyle: z.string().min(1),
});

export const PersonaTaskBehaviorInstructionsSchema = z.object({
  actNaturally: z.string().min(1),
  doNotOptimizeForTaskCompletion: z.string().min(1),
  verbalizeConfusion: z.string().min(1),
  abandonIfReasonable: z.string().min(1),
});

export const PersonaUXProfileSchema = z.object({
  personaId: z.string().min(1),
  displayName: z.string().min(1),
  sourceProvenance: PersonaSourceSchema,
  background: z.string().min(1),
  uxBehavior: PersonaUXBehaviorSchema,
  taskBehaviorInstructions: PersonaTaskBehaviorInstructionsSchema,
  promptBlock: z.string().min(1),
});

export type PersonaUXBehavior = z.infer<typeof PersonaUXBehaviorSchema>;
export type PersonaTaskBehaviorInstructions = z.infer<typeof PersonaTaskBehaviorInstructionsSchema>;
export type PersonaUXProfile = z.infer<typeof PersonaUXProfileSchema>;
