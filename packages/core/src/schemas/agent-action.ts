import { z } from "zod";

// AgentAction — see docs/04_RUNNER_ANALYZER_SPEC.md §Agent action schema.
// The runner translates each action into the corresponding `agent-browser`
// command (click @<ref> | fill @<ref> "..." | scroll <dir> | back | …) before
// the safety policy clears it for execution.
//
// Discriminated union on `type`. `reason` is required on every variant so the
// event log + interview generator can ground their narratives in the agent's
// own articulated motivation.

const reason = z.string().min(1);

export const AgentClickActionSchema = z.object({
  type: z.literal("click"),
  selector: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  reason,
});

export const AgentTypeActionSchema = z.object({
  type: z.literal("type"),
  selector: z.string().optional(),
  text: z.string(),
  reason,
});

export const AgentScrollActionSchema = z.object({
  type: z.literal("scroll"),
  direction: z.enum(["up", "down"]),
  amount: z.number().optional(),
  reason,
});

export const AgentWaitActionSchema = z.object({
  type: z.literal("wait"),
  durationMs: z.number().int().nonnegative(),
  reason,
});

export const AgentBackActionSchema = z.object({
  type: z.literal("back"),
  reason,
});

export const AgentStopActionSchema = z.object({
  type: z.literal("stop"),
  outcome: z.enum(["success", "dropoff", "blocked", "timeout"]),
  reason,
});

export const AgentActionSchema = z.discriminatedUnion("type", [
  AgentClickActionSchema,
  AgentTypeActionSchema,
  AgentScrollActionSchema,
  AgentWaitActionSchema,
  AgentBackActionSchema,
  AgentStopActionSchema,
]);

export type AgentAction = z.infer<typeof AgentActionSchema>;
export type AgentClickAction = z.infer<typeof AgentClickActionSchema>;
export type AgentTypeAction = z.infer<typeof AgentTypeActionSchema>;
export type AgentScrollAction = z.infer<typeof AgentScrollActionSchema>;
export type AgentWaitAction = z.infer<typeof AgentWaitActionSchema>;
export type AgentBackAction = z.infer<typeof AgentBackActionSchema>;
export type AgentStopAction = z.infer<typeof AgentStopActionSchema>;
