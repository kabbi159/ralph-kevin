import type { AgentAction } from "@personabench/core";
import { AgentActionSchema } from "@personabench/core";
import type { DecisionInput, DecisionProvider } from "./decision-provider";

// MockDecisionProvider — deterministic action plan for tests. Cycles through
// the supplied AgentAction[]. Stops the run when the plan is exhausted.

export class MockDecisionProvider implements DecisionProvider {
  readonly id = "mock";
  private readonly plan: AgentAction[];
  private cursor = 0;

  constructor(plan: AgentAction[]) {
    for (const a of plan) AgentActionSchema.parse(a);
    this.plan = plan;
  }

  decide(_input: DecisionInput): Promise<AgentAction> {
    const next = this.plan[this.cursor];
    this.cursor++;
    if (!next) {
      return Promise.resolve({
        type: "stop",
        outcome: "dropoff",
        reason: "MockDecisionProvider plan exhausted",
      });
    }
    return Promise.resolve(next);
  }

  reset(): void {
    this.cursor = 0;
  }
}
