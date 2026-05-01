import type { FrictionSignal, UXFinding } from "@personabench/core";

// Deterministic severity scoring per docs/04 §Severity scoring.
//   critical: blocks task completion for multiple personas (caller composes that)
//   high:     causes drop-off or inability to continue
//   medium:   significant hesitation/backtracking but eventually completes
//   low:      minor confusion, little impact

const HIGH_TYPES = new Set([
  "task_abandonment",
  "cta_not_found",
  "price_uncertainty",
  "trust_uncertainty",
]);

const LOW_TYPES = new Set(["scroll_search", "backtrack"]);

export const severityFor = (signals: FrictionSignal[]): UXFinding["severity"] => {
  if (signals.length === 0) return "low";
  const highCount = signals.filter(
    (s) => HIGH_TYPES.has(s.type) || s.severityHint === "high",
  ).length;
  const mediumCount = signals.filter((s) => s.severityHint === "medium").length;
  if (highCount >= 2) return "critical";
  if (highCount >= 1) return "high";
  if (mediumCount >= 2) return "medium";
  if (signals.every((s) => LOW_TYPES.has(s.type))) return "low";
  return "medium";
};
