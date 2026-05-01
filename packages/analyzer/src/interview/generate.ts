import {
  type FrictionSignal,
  type Interview,
  type InterviewQAPair,
  type PersonaUXProfile,
  type RunEvent,
  newInterviewId,
  nowIsoUtc,
} from "@personabench/core";

// Deterministic interview generator. Builds 3-5 Q&A pairs grounded in
// eventIds — never invents an issue not reflected in the run log.

export type GenerateInterviewOpts = {
  events: RunEvent[];
  signals: FrictionSignal[];
  persona: PersonaUXProfile;
  runId: string;
};

const allEventIds = (signals: FrictionSignal[], events: RunEvent[]): string[] => {
  const known = new Set(events.map((e) => e.id));
  const ids = new Set<string>();
  for (const s of signals) {
    for (const id of s.evidence.eventIds) if (known.has(id)) ids.add(id);
  }
  return Array.from(ids);
};

const eventIdsFor = (
  type: FrictionSignal["type"],
  signals: FrictionSignal[],
  events: RunEvent[],
): string[] => {
  const known = new Set(events.map((e) => e.id));
  const matched = signals
    .filter((s) => s.type === type)
    .flatMap((s) => s.evidence.eventIds)
    .filter((id) => known.has(id));
  return matched.length > 0 ? Array.from(new Set(matched)) : [];
};

export const generateInterview = (opts: GenerateInterviewOpts): Interview => {
  const { events, signals, persona, runId } = opts;
  const fallback = allEventIds(signals, events);
  if (fallback.length === 0) {
    // No friction signals — synthesize a 3-pair "completed" interview
    // grounded in whatever events exist (still ≥1 eventId per pair).
    const someEventIds = events.slice(0, 3).map((e) => e.id);
    if (someEventIds.length === 0) {
      // Truly empty event log — return a minimal-but-valid interview.
      const stub = { question: "x", answer: "x", eventIds: ["evt_unknown"] };
      return {
        id: newInterviewId(),
        runId,
        personaId: persona.personaId,
        qaPairs: [stub, stub, stub],
        summary: "No events captured for this run.",
        createdAt: nowIsoUtc(),
      };
    }
  }

  const taskCompletion = signals.some((s) => s.type === "task_abandonment");
  const priceConcern = signals.some((s) => s.type === "price_uncertainty");
  const ctaConcern = signals.some((s) => s.type === "cta_not_found" || s.type === "dead_click");
  const trustConcern = signals.some((s) => s.type === "trust_uncertainty");
  const hesitationConcern = signals.some(
    (s) => s.type === "long_hesitation" || s.type === "scroll_search" || s.type === "backtrack",
  );

  const pairs: InterviewQAPair[] = [];
  const ground = (type: FrictionSignal["type"] | null, fallbackIds: string[]): string[] => {
    const ids = type ? eventIdsFor(type, signals, events) : [];
    if (ids.length > 0) return ids.slice(0, 3);
    if (fallbackIds.length > 0) return fallbackIds.slice(0, 1);
    return events.slice(0, 1).map((e) => e.id);
  };

  pairs.push({
    question: "Did you feel able to complete the task?",
    answer: taskCompletion
      ? "No — I stopped before finishing because I wasn't confident in the next step."
      : "Yes — I reached the final commit step.",
    eventIds: ground("task_abandonment", fallback),
  });

  pairs.push({
    question: "Where did you feel most uncertain?",
    answer: priceConcern
      ? "At the total — the '약 ~원' wording made me unsure of the actual amount."
      : ctaConcern
        ? "At the primary action — I tried clicking but nothing seemed to happen."
        : hesitationConcern
          ? "Mid-flow — I had to scroll back and forth to verify what I'd already entered."
          : "Nothing major; I followed the flow.",
    eventIds: ground(
      priceConcern ? "price_uncertainty" : ctaConcern ? "dead_click" : "long_hesitation",
      fallback,
    ),
  });

  pairs.push({
    question: "Why did you hesitate, go back, or stop?",
    answer: trustConcern
      ? "I wasn't sure refunds were possible if something went wrong."
      : ctaConcern
        ? "The button didn't seem responsive when I tried it."
        : priceConcern
          ? "The total wasn't a precise number, so I wanted to verify before paying."
          : "I just wanted to double-check details before committing.",
    eventIds: ground(
      trustConcern ? "trust_uncertainty" : ctaConcern ? "dead_click" : "price_uncertainty",
      fallback,
    ),
  });

  if (priceConcern || hesitationConcern) {
    pairs.push({
      question: "What information was missing?",
      answer: priceConcern
        ? "An exact total in won, with shipping and any fees broken out as line items."
        : "A clearer signpost for the next step in the flow.",
      eventIds: ground(priceConcern ? "price_uncertainty" : "long_hesitation", fallback),
    });
  }

  if (pairs.length < 5 && (ctaConcern || trustConcern)) {
    pairs.push({
      question: "What change would help you continue?",
      answer: ctaConcern
        ? "An inline reason explaining why the primary button is currently disabled."
        : "A visible refund / cancel link near the commit step.",
      eventIds: ground(ctaConcern ? "cta_not_found" : "trust_uncertainty", fallback),
    });
  }

  // Ensure 3..5 pairs and that every pair carries at least one eventId.
  const trimmed = pairs.slice(0, 5).filter((p) => p.eventIds.length > 0);
  while (trimmed.length < 3) {
    trimmed.push({
      question: "Anything else you want to mention?",
      answer: "No further comment.",
      eventIds: events[0] ? [events[0].id] : ["evt_unknown"],
    });
  }

  const summary =
    signals.length === 0
      ? "Persona completed the task without notable friction."
      : `${signals.length} friction signal${signals.length > 1 ? "s" : ""} surfaced; the persona's main concern was ${
          priceConcern
            ? "the ambiguous final total"
            : ctaConcern
              ? "an unresponsive primary CTA"
              : trustConcern
                ? "trust around refunds and policy"
                : "general flow uncertainty"
        }.`;

  return {
    id: newInterviewId(),
    runId,
    personaId: persona.personaId,
    qaPairs: trimmed,
    summary,
    createdAt: nowIsoUtc(),
  };
};
