import type { Observation } from "@personabench/core";
import type { RawSnapshot } from "../browser/agent-browser-session";

// compactSnapshot — turn a raw agent-browser accessibility-tree dump into
// the slimmer Observation shape the DecisionProvider sees. Drops nested
// generics; keeps interactive refs (with role + label) + visible text.
//
// We deliberately do NOT serialize the full snapshot tree into the LLM
// prompt — observations grow into the multi-MB range on real pages.

const STOP_WORDS = new Set(["", "  "]);

const collectVisibleText = (node: unknown): string[] => {
  if (typeof node === "string") return STOP_WORDS.has(node) ? [] : [node.trim()];
  if (Array.isArray(node)) return node.flatMap(collectVisibleText);
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const out: string[] = [];
    if (typeof obj.text === "string") out.push(obj.text);
    if (typeof obj.name === "string") out.push(obj.name);
    if (typeof obj.value === "string") out.push(obj.value);
    if (Array.isArray(obj.children)) out.push(...obj.children.flatMap(collectVisibleText));
    return out;
  }
  return [];
};

export type CompactedObservation = Observation & {
  // The original snapshot is preserved separately so the recorder can dump
  // it under .personabench/runs/<runId>/observations/<step>.json.
  origin: string;
  refs: string[];
};

export const compactSnapshot = (raw: RawSnapshot): CompactedObservation => {
  const interactive: NonNullable<Observation["interactiveElements"]> = [];
  for (const [ref, info] of Object.entries(raw.refs ?? {})) {
    interactive.push({
      role: info?.role ?? undefined,
      label: info?.name ?? undefined,
      selector: `@${ref}`,
    });
  }

  const visibleParts = collectVisibleText(raw.snapshot)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  // De-duplicate while preserving order; cap length so the LLM prompt stays
  // bounded.
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const s of visibleParts) {
    if (seen.has(s)) continue;
    seen.add(s);
    unique.push(s);
    if (unique.join(" ").length > 4000) break;
  }
  const visibleText = unique.join(" — ");

  return {
    origin: raw.origin,
    refs: Object.keys(raw.refs ?? {}),
    visibleText: visibleText.length > 0 ? visibleText : undefined,
    interactiveElements: interactive.length > 0 ? interactive : undefined,
  };
};
