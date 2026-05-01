import { join } from "node:path";
import {
  type AgentAction,
  type PersonaUXProfile,
  type RunConfig,
  type RunEvent,
  newEventId,
} from "@personabench/core";
import type { AgentBrowserSession } from "./browser/agent-browser-session";
import type { DecisionProvider } from "./decide/decision-provider";
import type { EventSink } from "./event-log";
import { compactSnapshot } from "./observe/compact-snapshot";
import { type SafetyContext, checkAction } from "./safety/policy";

// Stop reasons mapped onto docs/04 stop outcomes plus the runner-internal
// budget / safety branches. Persisted on the final RunEvent and surfaced
// to the CLI / web app as the run's `failureReason` (if non-success).

export type StopReason =
  | "success"
  | "dropoff"
  | "blocked"
  | "timeout"
  | "action_limit"
  | "safety_violation"
  | "payment_blocked"
  | "destructive_blocked"
  | "domain_not_allowed";

export type RunPersonaTestOpts = {
  runId: string;
  personaProfile: PersonaUXProfile;
  config: RunConfig;
  decisionProvider: DecisionProvider;
  browser: AgentBrowserSession;
  runDir: string;
  eventSink: EventSink;
  // Now is injectable so tests can drive the deadline branch deterministically.
  now?: () => number;
};

export type RunPersonaTestResult = {
  stopReason: StopReason;
  eventCount: number;
  finalUrl: string;
};

const HISTORY_WINDOW = 5;

export const runPersonaTest = async (opts: RunPersonaTestOpts): Promise<RunPersonaTestResult> => {
  const { runId, personaProfile, config, decisionProvider, browser, runDir, eventSink } = opts;
  const now = opts.now ?? Date.now;
  const startedAt = now();
  const deadlineMs = startedAt + config.limits.maxDurationSec * 1000;

  const safetyBase: Omit<SafetyContext, "observation"> = {
    allowedDomains: config.safety.allowedDomains,
    blockPaymentSubmission: config.safety.blockPaymentSubmission,
    blockDestructiveActions: config.safety.blockDestructiveActions,
    redactSensitiveFields: config.safety.redactSensitiveFields,
  };

  const personaId = personaProfile.personaId;
  let stepIndex = 0;
  let stopReason: StopReason | null = null;
  let currentUrl = config.targetUrl;
  const history: RunEvent[] = [];

  const writeEvent = (partial: Partial<RunEvent> & { stepIndex: number }): void => {
    const ev: RunEvent = {
      id: newEventId(),
      runId,
      personaId,
      timestampMs: now(),
      stepIndex: partial.stepIndex,
      page: partial.page ?? { url: currentUrl },
      observation: partial.observation,
      action: partial.action,
      result: partial.result,
      thoughtSummary: partial.thoughtSummary,
    };
    eventSink(ev);
    history.push(ev);
    if (history.length > HISTORY_WINDOW * 2) history.splice(0, history.length - HISTORY_WINDOW * 2);
  };

  const screenshotPath = (idx: number): string => `artifacts/screenshots/${idx}.png`;

  await browser.open(config.targetUrl);

  while (stopReason === null) {
    if (stepIndex >= config.limits.maxActions) {
      stopReason = "action_limit";
      break;
    }
    if (now() >= deadlineMs) {
      stopReason = "timeout";
      break;
    }

    const snap = await browser.snapshot();
    currentUrl = snap.raw.origin;
    const observation = compactSnapshot(snap.raw);

    // H2 enforcement — re-check allowlist after every snapshot.
    if (
      safetyBase.allowedDomains.length > 0 &&
      observation.origin &&
      !originAllowed(observation.origin, safetyBase.allowedDomains)
    ) {
      writeEvent({
        stepIndex,
        page: { url: observation.origin },
        observation,
        result: { errorText: ["domain_not_allowed"] },
      });
      stopReason = "domain_not_allowed";
      break;
    }

    if (config.artifacts.screenshots) {
      const path = screenshotPath(stepIndex);
      try {
        await browser.screenshot(join(runDir, path));
      } catch {
        // best-effort screenshot
      }
    }

    let action: AgentAction;
    try {
      action = await decisionProvider.decide({
        observation,
        persona: personaProfile,
        task: config.task,
        successCriteria: config.successCriteria,
        recentHistory: history.slice(-HISTORY_WINDOW),
        budget: {
          actionsRemaining: config.limits.maxActions - stepIndex,
          secondsRemaining: Math.max(0, Math.floor((deadlineMs - now()) / 1000)),
        },
      });
    } catch (err) {
      writeEvent({
        stepIndex,
        observation,
        result: { errorText: [`decision_error: ${(err as Error).message}`] },
      });
      stopReason = "blocked";
      break;
    }

    // H1 enforcement — gate every AgentAction through checkAction before it
    // ever reaches AgentBrowserSession.
    const decision = checkAction(action, { ...safetyBase, observation });
    if (decision.kind === "block") {
      writeEvent({
        stepIndex,
        observation,
        action,
        result: { errorText: [decision.reason, decision.detail] },
        thoughtSummary: action.reason,
      });
      switch (decision.reason) {
        case "payment_blocked":
          stopReason = "payment_blocked";
          break;
        case "destructive_blocked":
          stopReason = "destructive_blocked";
          break;
        case "domain_not_allowed":
          stopReason = "domain_not_allowed";
          break;
        default:
          stopReason = "safety_violation";
      }
      break;
    }
    const safeAction: AgentAction = decision.kind === "transform" ? decision.action : action;

    // Execute the (possibly transformed) action.
    let result: RunEvent["result"];
    try {
      result = await executeAction(browser, safeAction, screenshotPath(stepIndex));
    } catch (err) {
      writeEvent({
        stepIndex,
        observation,
        action: safeAction,
        result: { errorText: [`execute_error: ${(err as Error).message}`] },
        thoughtSummary: safeAction.reason,
      });
      stopReason = "blocked";
      break;
    }

    writeEvent({
      stepIndex,
      observation,
      action: safeAction,
      result,
      thoughtSummary: safeAction.reason,
    });

    if (safeAction.type === "stop") {
      stopReason = safeAction.outcome as StopReason;
      break;
    }
    stepIndex++;
  }

  await browser.close();
  return {
    stopReason: stopReason ?? "dropoff",
    eventCount: history.length,
    finalUrl: currentUrl,
  };
};

const originAllowed = (origin: string, allowed: string[]): boolean => {
  let host = "";
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }
  for (const e of allowed) {
    const lo = e.toLowerCase();
    if (host === lo || host.endsWith(`.${lo}`)) return true;
  }
  return false;
};

const executeAction = async (
  browser: AgentBrowserSession,
  action: AgentAction,
  screenshotPath: string,
): Promise<RunEvent["result"]> => {
  switch (action.type) {
    case "click":
      if (action.selector) await browser.click(action.selector);
      return { domChanged: true, screenshotPath };
    case "type":
      if (action.selector) await browser.fill(action.selector, action.text);
      return { domChanged: true, screenshotPath };
    case "scroll":
      await browser.scroll(action.direction);
      return { domChanged: false, screenshotPath };
    case "back":
      await browser.back();
      return { urlChanged: true, screenshotPath };
    case "wait":
      await new Promise((r) => setTimeout(r, Math.min(action.durationMs, 30_000)));
      return { domChanged: false };
    case "stop":
      return undefined;
  }
};
