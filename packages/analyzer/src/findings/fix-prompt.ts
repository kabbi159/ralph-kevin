import type { FrictionSignalType, PersonaUXProfile, UXFinding } from "@personabench/core";

// Renders docs/04 §Coding-agent fix prompt structure for one finding.
// The output is plain Markdown so it can be pasted into a PR comment, a
// Linear issue, or fed to a Claude / Codex coding session as-is.

const SUGGESTED_FILES_BY_TYPE: Partial<Record<FrictionSignalType, string>> = {
  price_uncertainty:
    "examples/ecommerce-checkout/app/checkout/page.tsx — totalDisplay + the shipping toggle.",
  cta_not_found:
    "examples/ecommerce-checkout/app/checkout/page.tsx — the disabled '결제 확정' button block.",
  dead_click:
    "examples/ecommerce-checkout/app/checkout/page.tsx — the '결제 확정' button's `disabled` condition (no inline error reason).",
  trust_uncertainty: "Refund / cancellation policy link near the CTA.",
};

export type FixPromptInput = {
  finding: UXFinding;
  persona: PersonaUXProfile;
  targetUrl: string;
  task: string;
  signalTypes: FrictionSignalType[];
};

export const renderFixPrompt = (input: FixPromptInput): string => {
  const { finding, persona, targetUrl, task, signalTypes } = input;
  const lines: string[] = [];
  lines.push(`# UX Fix Task: ${finding.title}`);
  lines.push("");
  lines.push("## Context");
  lines.push(`- Product flow: ${task}`);
  lines.push(`- URL: ${targetUrl}`);
  lines.push(`- Persona: ${persona.displayName} (${persona.personaId})`);
  lines.push(
    `  - Source: ${persona.sourceProvenance.provider} / ${persona.sourceProvenance.dataset}`,
  );
  lines.push("");
  lines.push("## Observed behavior");
  lines.push(finding.diagnosis.observedBehavior);
  lines.push("");
  lines.push("## Evidence");
  if (finding.evidence.timestamps.length) {
    lines.push(`- Timestamps: ${finding.evidence.timestamps.join(", ")}`);
  }
  lines.push(`- Events: ${finding.evidence.eventIds.join(", ")}`);
  if (finding.evidence.screenshots?.length) {
    lines.push(`- Screenshots: ${finding.evidence.screenshots.join(", ")}`);
  }
  if (finding.evidence.replayPath) lines.push(`- Replay: ${finding.evidence.replayPath}`);
  lines.push("");
  lines.push("## Likely cause");
  lines.push(finding.diagnosis.likelyCause);
  lines.push("");
  lines.push("## Required fix");
  lines.push(finding.recommendation.uxChange);
  if (finding.recommendation.implementationHint) {
    lines.push("");
    lines.push(`Implementation hint: ${finding.recommendation.implementationHint}`);
  }
  // Type-driven suggested file (best-effort; skipped if no match)
  for (const t of signalTypes) {
    const hint = SUGGESTED_FILES_BY_TYPE[t];
    if (hint) {
      lines.push(`Likely files: ${hint}`);
      break;
    }
  }
  lines.push("");
  lines.push("## Acceptance criteria");
  for (const c of finding.recommendation.acceptanceCriteria) lines.push(`- ${c}`);
  lines.push("");
  lines.push("## Constraints");
  lines.push("- Keep scope small.");
  lines.push("- Do not introduce unrelated redesigns.");
  lines.push("- Do not change business logic unless necessary.");
  lines.push(
    "- Rerun PersonaBench after the fix and verify the finding moves to `resolved` in the compare view.",
  );
  return lines.join("\n");
};
