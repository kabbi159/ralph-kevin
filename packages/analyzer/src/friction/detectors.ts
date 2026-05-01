import {
  type FrictionSignal,
  type FrictionSignalType,
  type RunEvent,
  newSignalId,
} from "@personabench/core";

// Friction detectors. Each takes RunEvent[] and returns FrictionSignal[].
// Heuristics are deterministic and operate offline on the event log — no LLM
// in this layer (the analyzer's LLM-backed work happens in finding generation
// and interview generation in the same package).

type DetectorContext = {
  events: RunEvent[];
  runId: string;
  personaId: string;
};

type DetectorFn = (ctx: DetectorContext) => FrictionSignal[];

const PRICE_TOKENS = ["약", "approximate", "approximately", "₩", "krw", "$", "원~", "~원"];
const TRUST_TOKENS = ["환불", "refund", "취소", "cancel", "privacy", "policy", "정책", "secure"];

// 1. long_hesitation — wait action ≥10s OR no progress for ≥15s
export const detectLongHesitation: DetectorFn = ({ events, runId, personaId }) => {
  const out: FrictionSignal[] = [];
  for (const ev of events) {
    if (ev.action?.type === "wait" && ev.action.durationMs >= 10_000) {
      out.push({
        id: newSignalId(),
        runId,
        personaId,
        type: "long_hesitation",
        severityHint: ev.action.durationMs >= 20_000 ? "high" : "medium",
        timestampStartMs: ev.timestampMs,
        timestampEndMs: ev.timestampMs + ev.action.durationMs,
        evidence: {
          eventIds: [ev.id],
          notes: `Waited ${(ev.action.durationMs / 1000).toFixed(1)}s before next action.`,
        },
      });
    }
  }
  // Gap detector — ≥15s between consecutive events
  for (let i = 1; i < events.length; i++) {
    const a = events[i - 1];
    const b = events[i];
    if (!a || !b) continue;
    const gap = b.timestampMs - a.timestampMs;
    if (gap >= 15_000) {
      out.push({
        id: newSignalId(),
        runId,
        personaId,
        type: "long_hesitation",
        severityHint: gap >= 30_000 ? "high" : "medium",
        timestampStartMs: a.timestampMs,
        timestampEndMs: b.timestampMs,
        evidence: {
          eventIds: [a.id, b.id],
          notes: `${(gap / 1000).toFixed(1)}s passed without meaningful progress.`,
        },
      });
    }
  }
  return out;
};

// 2. repeated_click — 3+ clicks on same selector within 10s
export const detectRepeatedClick: DetectorFn = ({ events, runId, personaId }) => {
  const out: FrictionSignal[] = [];
  const clicks = events.filter(
    (e) => e.action?.type === "click" && typeof e.action.selector === "string",
  );
  for (let i = 0; i < clicks.length; i++) {
    const a = clicks[i];
    if (!a?.action || a.action.type !== "click") continue;
    const selector = a.action.selector;
    const window: typeof clicks = [a];
    for (let j = i + 1; j < clicks.length; j++) {
      const b = clicks[j];
      if (!b?.action || b.action.type !== "click") continue;
      if (b.action.selector !== selector) continue;
      if (b.timestampMs - a.timestampMs > 10_000) break;
      window.push(b);
    }
    if (window.length >= 3) {
      out.push({
        id: newSignalId(),
        runId,
        personaId,
        type: "repeated_click",
        severityHint: "medium",
        timestampStartMs: a.timestampMs,
        timestampEndMs: window[window.length - 1]?.timestampMs ?? a.timestampMs,
        evidence: {
          eventIds: window.map((w) => w.id),
          notes: `${window.length} clicks on ${selector} within ${
            ((window[window.length - 1]?.timestampMs ?? 0) - a.timestampMs) / 1000
          }s.`,
        },
      });
      i += window.length - 1;
    }
  }
  return out;
};

// 3. dead_click — click event with result.urlChanged=false AND result.domChanged=false
export const detectDeadClick: DetectorFn = ({ events, runId, personaId }) => {
  const out: FrictionSignal[] = [];
  for (const ev of events) {
    if (
      ev.action?.type === "click" &&
      ev.result?.urlChanged === false &&
      ev.result?.domChanged === false
    ) {
      out.push({
        id: newSignalId(),
        runId,
        personaId,
        type: "dead_click",
        severityHint: "medium",
        timestampStartMs: ev.timestampMs,
        evidence: {
          eventIds: [ev.id],
          screenshotPaths: ev.result?.screenshotPath ? [ev.result.screenshotPath] : undefined,
          notes: `Click on ${ev.action.selector ?? "?"} did not change URL or DOM.`,
        },
      });
    }
  }
  return out;
};

// 4. backtrack — back action OR repeated navigation between same two URLs
export const detectBacktrack: DetectorFn = ({ events, runId, personaId }) => {
  const out: FrictionSignal[] = [];
  for (const ev of events) {
    if (ev.action?.type === "back") {
      out.push({
        id: newSignalId(),
        runId,
        personaId,
        type: "backtrack",
        severityHint: "low",
        timestampStartMs: ev.timestampMs,
        evidence: {
          eventIds: [ev.id],
          notes: `Pressed back: ${ev.action.reason}`,
        },
      });
    }
  }
  return out;
};

// 5. cta_not_found — task abandoned without clicking the high-prominence CTA, OR many scrolls without CTA click
export const detectCtaNotFound: DetectorFn = ({ events, runId, personaId }) => {
  const out: FrictionSignal[] = [];
  const stop = events.find((e) => e.action?.type === "stop");
  const hasCtaClick = events.some((e) => {
    const action = e.action;
    if (!action || action.type !== "click") return false;
    const targetSelector = action.selector;
    const label =
      e.observation?.interactiveElements
        ?.find((x) => x.selector === targetSelector)
        ?.label?.toLowerCase() ?? "";
    return /확정|결제|pay|order|continue|next|다음|구매/.test(label);
  });
  if (stop && stop.action?.type === "stop" && stop.action.outcome !== "success" && !hasCtaClick) {
    out.push({
      id: newSignalId(),
      runId,
      personaId,
      type: "cta_not_found",
      severityHint: "high",
      timestampStartMs: stop.timestampMs,
      evidence: {
        eventIds: [stop.id],
        notes: `Run ended with stopReason=${stop.action.outcome} and no primary CTA click.`,
      },
    });
  }
  return out;
};

// 6. scroll_search — 3+ scrolls with no click between them
export const detectScrollSearch: DetectorFn = ({ events, runId, personaId }) => {
  const out: FrictionSignal[] = [];
  let runStart: RunEvent | undefined;
  let runIds: string[] = [];
  for (const ev of events) {
    if (ev.action?.type === "scroll") {
      if (!runStart) runStart = ev;
      runIds.push(ev.id);
    } else if (ev.action?.type === "click" || ev.action?.type === "type") {
      if (runStart && runIds.length >= 3) {
        out.push({
          id: newSignalId(),
          runId,
          personaId,
          type: "scroll_search",
          severityHint: "low",
          timestampStartMs: runStart.timestampMs,
          timestampEndMs: ev.timestampMs,
          evidence: {
            eventIds: runIds,
            notes: `${runIds.length} consecutive scrolls without an interactive action.`,
          },
        });
      }
      runStart = undefined;
      runIds = [];
    }
  }
  if (runStart && runIds.length >= 3) {
    out.push({
      id: newSignalId(),
      runId,
      personaId,
      type: "scroll_search",
      severityHint: "low",
      timestampStartMs: runStart.timestampMs,
      evidence: {
        eventIds: runIds,
        notes: `${runIds.length} scrolls trailing the run with no click.`,
      },
    });
  }
  return out;
};

// 7. price_uncertainty — visible text contains ambiguous-price markers
export const detectPriceUncertainty: DetectorFn = ({ events, runId, personaId }) => {
  const out: FrictionSignal[] = [];
  for (const ev of events) {
    const text = ev.observation?.visibleText?.toLowerCase() ?? "";
    if (!text) continue;
    const hasAmbig =
      text.includes("약") ||
      text.includes("approximate") ||
      text.includes("approximately") ||
      text.includes("~원") ||
      text.includes("원~");
    const hasPriceContext = PRICE_TOKENS.some((t) => text.includes(t));
    if (hasAmbig && hasPriceContext) {
      out.push({
        id: newSignalId(),
        runId,
        personaId,
        type: "price_uncertainty",
        severityHint: "high",
        timestampStartMs: ev.timestampMs,
        evidence: {
          eventIds: [ev.id],
          screenshotPaths: ev.result?.screenshotPath ? [ev.result.screenshotPath] : undefined,
          notes: "Page shows an approximate / tilde-suffixed total instead of an exact figure.",
        },
      });
      // one signal per run is enough — extra duplicates dilute the report
      break;
    }
  }
  return out;
};

// 8. trust_uncertainty — persona's thoughtSummary mentions refund/cancel/privacy concern
export const detectTrustUncertainty: DetectorFn = ({ events, runId, personaId }) => {
  const out: FrictionSignal[] = [];
  for (const ev of events) {
    const t = (ev.thoughtSummary ?? "").toLowerCase();
    if (!t) continue;
    if (TRUST_TOKENS.some((tok) => t.includes(tok))) {
      out.push({
        id: newSignalId(),
        runId,
        personaId,
        type: "trust_uncertainty",
        severityHint: "medium",
        timestampStartMs: ev.timestampMs,
        evidence: {
          eventIds: [ev.id],
          notes: `Persona expressed trust concern: "${ev.thoughtSummary}"`,
        },
      });
    }
  }
  return out;
};

// 9. task_abandonment — explicit stop with outcome=dropoff/blocked/timeout
export const detectTaskAbandonment: DetectorFn = ({ events, runId, personaId }) => {
  const out: FrictionSignal[] = [];
  for (const ev of events) {
    if (ev.action?.type === "stop" && ev.action.outcome !== "success") {
      out.push({
        id: newSignalId(),
        runId,
        personaId,
        type: "task_abandonment",
        severityHint: "high",
        timestampStartMs: ev.timestampMs,
        evidence: {
          eventIds: [ev.id],
          notes: `Task abandoned with outcome=${ev.action.outcome}: ${ev.action.reason}`,
        },
      });
    }
  }
  return out;
};

const ALL_DETECTORS: Array<{ type: FrictionSignalType; fn: DetectorFn }> = [
  { type: "long_hesitation", fn: detectLongHesitation },
  { type: "repeated_click", fn: detectRepeatedClick },
  { type: "dead_click", fn: detectDeadClick },
  { type: "backtrack", fn: detectBacktrack },
  { type: "cta_not_found", fn: detectCtaNotFound },
  { type: "scroll_search", fn: detectScrollSearch },
  { type: "price_uncertainty", fn: detectPriceUncertainty },
  { type: "trust_uncertainty", fn: detectTrustUncertainty },
  { type: "task_abandonment", fn: detectTaskAbandonment },
];

export const runDetectors = (
  events: RunEvent[],
  ctx: { runId: string; personaId: string },
): FrictionSignal[] => {
  const detectorCtx: DetectorContext = { events, runId: ctx.runId, personaId: ctx.personaId };
  const all: FrictionSignal[] = [];
  for (const { fn } of ALL_DETECTORS) {
    all.push(...fn(detectorCtx));
  }
  return all;
};
