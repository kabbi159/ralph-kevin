import type { AgentAction, PersonaUXProfile, RunEvent } from "@personabench/core";
import type { CompactedObservation } from "../observe/compact-snapshot";

// DecisionProvider — see docs/04_RUNNER_ANALYZER_SPEC.md §Runner loop and
// boot-prompt §Pre-decided. The runner asks "what would this persona do
// next?" once per step, the provider returns an AgentAction, the runner's
// safety policy clears it, and the AgentBrowserSession executes it.

export type DecisionInput = {
  observation: CompactedObservation;
  persona: PersonaUXProfile;
  task: string;
  successCriteria?: string[];
  // The last few RunEvents in chronological order — keeps the provider
  // grounded in what the agent has already tried.
  recentHistory: RunEvent[];
  // The runner's stop conditions; included so the provider can choose to stop
  // early instead of pushing to maxActions.
  budget: { actionsRemaining: number; secondsRemaining: number };
};

export interface DecisionProvider {
  readonly id: string;
  decide(input: DecisionInput): Promise<AgentAction>;
}

export type DecisionProviderFactory = () => DecisionProvider;
