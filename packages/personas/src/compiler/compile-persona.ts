import type { PersonaRecord, PersonaUXProfile } from "@personabench/core";
import { PersonaUXProfileSchema } from "@personabench/core";
import {
  REQUIRED_SYSTEM_INSTRUCTION,
  TASK_BEHAVIOR_DEFAULTS,
  UNTRUSTED_CONTENT_INSTRUCTION,
} from "./prompt-templates";

// PersonaCompiler — record → PersonaUXProfile.
//
// AGENTS.md / docs/03 invariants enforced here:
//   - provenance preserved (sourceProvenance ← record.source)
//   - no demographic claim invented (occupation / age / region only mentioned
//     when present on the input record)
//   - no representativeness claim ("typical", "average user", "real customer"
//     phrasing is forbidden in the rendered promptBlock)
//   - required system instruction is included verbatim

export type ProductContext = {
  productSummary?: string;
  task?: string;
  successCriteria?: string[];
};

const TRAIT_BAND = (v: number | undefined): "low" | "medium" | "high" | "unknown" => {
  if (typeof v !== "number") return "unknown";
  if (v <= 2) return "low";
  if (v >= 4) return "high";
  return "medium";
};

const renderDigitalConfidence = (r: PersonaRecord): string => {
  const literacy = TRAIT_BAND(r.derivedTraits?.digitalLiteracy);
  const mobile = TRAIT_BAND(r.derivedTraits?.mobileConfidence);
  if (literacy === "unknown" && mobile === "unknown") {
    return "Comfortable with familiar interfaces, slow to explore unfamiliar UI.";
  }
  if (literacy === "high" && (mobile === "high" || mobile === "unknown")) {
    return "Highly confident with mobile and desktop interfaces; expects fast feedback.";
  }
  if (literacy === "high" && mobile === "low") {
    return "Confident on desktop, hesitant on small mobile screens.";
  }
  if (literacy === "low") {
    return "Hesitant with new interfaces; reads slowly and rechecks before committing.";
  }
  return "Comfortable with common flows; may pause when controls behave unexpectedly.";
};

const renderDecisionStyle = (r: PersonaRecord): string => {
  const price = TRAIT_BAND(r.derivedTraits?.priceSensitivity);
  const risk = TRAIT_BAND(r.derivedTraits?.riskAversion);
  const detail = TRAIT_BAND(r.derivedTraits?.detailOrientation);
  if (price === "high" && risk === "high") {
    return "Compares prices and refund terms before committing; suspicious of hidden costs.";
  }
  if (detail === "high") {
    return "Reads disclosures and small print before any commit step.";
  }
  if (price === "high") {
    return "Sensitive to total cost; pauses when the price is ambiguous.";
  }
  if (risk === "high") {
    return "Risk-averse; checks reversibility (refund / cancel) before paying.";
  }
  return "Balances speed and confidence; will commit when the next step is obvious.";
};

const renderConcerns = (r: PersonaRecord): string[] => {
  const concerns: string[] = [];
  if (TRAIT_BAND(r.derivedTraits?.priceSensitivity) === "high") {
    concerns.push("Whether the displayed total is the actual final amount.");
    concerns.push("Whether shipping or service fees are added later.");
  }
  if (TRAIT_BAND(r.derivedTraits?.trustSensitivity) === "high") {
    concerns.push("Whether refund and cancellation are clearly available.");
    concerns.push("Whether the site is trustworthy enough to enter payment info.");
  }
  if (TRAIT_BAND(r.derivedTraits?.riskAversion) === "high") {
    concerns.push("Whether this action is reversible.");
  }
  if (concerns.length === 0) {
    concerns.push("Whether the next step does what it claims.");
  }
  return concerns;
};

const renderFrictionTriggers = (r: PersonaRecord): string[] => {
  const triggers: string[] = [];
  if (TRAIT_BAND(r.derivedTraits?.patience) === "low") {
    triggers.push("Slow page transitions or interstitial loading.");
    triggers.push("Multi-step forms without progress indication.");
  }
  if (TRAIT_BAND(r.derivedTraits?.digitalLiteracy) === "low") {
    triggers.push("Disabled controls without an inline reason.");
    triggers.push("Iconography without text labels.");
  }
  if (TRAIT_BAND(r.derivedTraits?.priceSensitivity) === "high") {
    triggers.push("Approximate or rounded totals (e.g. 'about ~ won').");
    triggers.push("Costs revealed only after expanding a section.");
  }
  if (triggers.length === 0) {
    triggers.push("Unclear primary CTA.");
  }
  return triggers;
};

const renderTrustSignals = (r: PersonaRecord): string[] => {
  const signals: string[] = [];
  if (TRAIT_BAND(r.derivedTraits?.trustSensitivity) === "high") {
    signals.push("Visible refund / cancellation policy link.");
    signals.push("Plain-text final total before the commit button.");
  }
  if (TRAIT_BAND(r.derivedTraits?.priceSensitivity) === "high") {
    signals.push("Explicit shipping fee shown above the total.");
  }
  signals.push("CTA text that matches the action that will be taken.");
  return signals;
};

const renderCompletionStyle = (r: PersonaRecord): string => {
  const patience = TRAIT_BAND(r.derivedTraits?.patience);
  const trust = TRAIT_BAND(r.derivedTraits?.trustSensitivity);
  if (patience === "low") {
    return "Drops off quickly when uncertain; will not retry the same blocked step twice.";
  }
  if (trust === "high") {
    return "Pauses to verify before paying; switches to another tab or app to double-check.";
  }
  return "Continues forward as long as each step looks coherent.";
};

const renderDisplayName = (r: PersonaRecord): string => {
  const parts: string[] = [];
  if (typeof r.demographics.age === "number") parts.push(`${r.demographics.age}`);
  if (r.demographics.occupation) parts.push(r.demographics.occupation);
  if (r.locale.province) parts.push(r.locale.province);
  if (parts.length === 0) {
    return r.id;
  }
  return parts.join(" · ");
};

const renderBackground = (r: PersonaRecord): string => {
  const lines: string[] = [];
  const locale = [r.locale.country, r.locale.province, r.locale.district]
    .filter(Boolean)
    .join(" / ");
  if (locale) lines.push(`Location: ${locale}.`);
  const demo = [
    typeof r.demographics.age === "number" ? `age ${r.demographics.age}` : null,
    r.demographics.sex,
    r.demographics.maritalStatus,
    r.demographics.occupation,
    r.demographics.educationLevel,
  ]
    .filter(Boolean)
    .join(", ");
  if (demo) lines.push(`Demographics: ${demo}.`);
  if (r.narratives.persona) lines.push(r.narratives.persona);
  if (r.narratives.professionalPersona) lines.push(r.narratives.professionalPersona);
  if (r.narratives.culturalBackground) lines.push(r.narratives.culturalBackground);
  if (lines.length === 0) {
    lines.push("No additional background available.");
  }
  return lines.join(" ");
};

const renderPromptBlock = (
  r: PersonaRecord,
  bg: string,
  productContext?: ProductContext,
): string => {
  const lines: string[] = [];
  lines.push("# Persona");
  lines.push(bg);
  lines.push("");
  lines.push("# Provenance");
  lines.push(
    `Source: ${r.source.provider} / ${r.source.dataset}${
      r.source.rowId ? ` / row ${r.source.rowId}` : ""
    }`,
  );
  if (r.source.license) lines.push(`License: ${r.source.license}`);
  lines.push("");
  lines.push("# Operating instructions");
  lines.push(REQUIRED_SYSTEM_INSTRUCTION);
  lines.push("");
  lines.push(UNTRUSTED_CONTENT_INSTRUCTION);
  if (productContext?.productSummary || productContext?.task) {
    lines.push("");
    lines.push("# Task context");
    if (productContext.productSummary) lines.push(productContext.productSummary);
    if (productContext.task) lines.push(`Task: ${productContext.task}`);
    if (productContext.successCriteria?.length) {
      lines.push("Success criteria:");
      for (const c of productContext.successCriteria) lines.push(`- ${c}`);
    }
  }
  return lines.join("\n");
};

export const compilePersona = (
  record: PersonaRecord,
  productContext?: ProductContext,
): PersonaUXProfile => {
  const background = renderBackground(record);
  const profile: PersonaUXProfile = {
    personaId: record.id,
    displayName: renderDisplayName(record),
    sourceProvenance: record.source,
    background,
    uxBehavior: {
      digitalConfidence: renderDigitalConfidence(record),
      decisionStyle: renderDecisionStyle(record),
      likelyConcerns: renderConcerns(record),
      frictionTriggers: renderFrictionTriggers(record),
      trustSignals: renderTrustSignals(record),
      completionStyle: renderCompletionStyle(record),
    },
    taskBehaviorInstructions: { ...TASK_BEHAVIOR_DEFAULTS },
    promptBlock: renderPromptBlock(record, background, productContext),
  };

  // Validate before returning so a bug in the renderer surfaces here, not at
  // a downstream consumer.
  return PersonaUXProfileSchema.parse(profile);
};
