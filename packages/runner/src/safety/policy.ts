import type { AgentAction } from "@personabench/core";
import type { CompactedObservation } from "../observe/compact-snapshot";
import { isSensitiveSelector, redactSensitiveText } from "./redact";

// Safety policy — see docs/04 §Action safety + docs/07 §Security baseline.
// The runner runs this BEFORE forwarding any agent-browser command. Any
// non-allow result halts (or transforms) the action.

export type SafetyContext = {
  allowedDomains: string[];
  blockPaymentSubmission: boolean;
  blockDestructiveActions: boolean;
  redactSensitiveFields: boolean;
  observation?: CompactedObservation;
};

export type SafetyDecision =
  | { kind: "allow"; action: AgentAction }
  | {
      kind: "block";
      reason: "domain_not_allowed" | "payment_blocked" | "destructive_blocked" | "safety_violation";
      detail: string;
    }
  | { kind: "transform"; action: AgentAction; note: string };

const PAYMENT_PATTERNS = [
  /\bpay\b/,
  /payment/,
  /checkout-?confirm/,
  /confirm-?pay/,
  /submit-?payment/,
  /place[\s\-_]?order/,
  /결제\s?확정/,
  /결제하기/,
];
const DESTRUCTIVE_PATTERNS = [
  /delete[-_]?account/,
  /close[-_]?account/,
  /deactivate/,
  /\bdrop\b/,
  /\bpurge\b/,
  /계정\s?삭제/,
  /탈퇴/,
];

const matchesAny = (haystack: string, patterns: RegExp[]): boolean =>
  patterns.some((p) => p.test(haystack));

const elementText = (
  selector: string | undefined,
  observation: CompactedObservation | undefined,
): string => {
  if (!selector || !observation) return "";
  const refMatch = selector.match(/^@(e\d+)$/);
  if (!refMatch) return selector;
  const target = observation.interactiveElements?.find((e) => e.selector === selector);
  return [target?.label, target?.role].filter(Boolean).join(" ");
};

const isInsideAllowlist = (origin: string | undefined, allowed: string[]): boolean => {
  if (!origin) return false;
  let host = "";
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }
  for (const entry of allowed) {
    const e = entry.toLowerCase();
    if (host === e) return true;
    if (host.endsWith(`.${e}`)) return true;
  }
  return false;
};

export const checkAction = (action: AgentAction, ctx: SafetyContext): SafetyDecision => {
  // Allowlist check applies to the current page origin, not the action itself.
  if (
    ctx.observation?.origin &&
    ctx.allowedDomains.length > 0 &&
    !isInsideAllowlist(ctx.observation.origin, ctx.allowedDomains)
  ) {
    return {
      kind: "block",
      reason: "domain_not_allowed",
      detail: `Page origin ${ctx.observation.origin} is not in the allowlist [${ctx.allowedDomains.join(", ")}]`,
    };
  }

  if (action.type === "click" && ctx.blockPaymentSubmission) {
    const text = elementText(action.selector, ctx.observation).toLowerCase();
    if (matchesAny(text, PAYMENT_PATTERNS)) {
      return {
        kind: "block",
        reason: "payment_blocked",
        detail: `Click on '${text}' looks like a final payment action.`,
      };
    }
  }

  if (action.type === "click" && ctx.blockDestructiveActions) {
    const text = elementText(action.selector, ctx.observation).toLowerCase();
    if (matchesAny(text, DESTRUCTIVE_PATTERNS)) {
      return {
        kind: "block",
        reason: "destructive_blocked",
        detail: `Click on '${text}' looks like a destructive action.`,
      };
    }
  }

  if (action.type === "type" && ctx.redactSensitiveFields) {
    if (isSensitiveSelector(action.selector)) {
      return {
        kind: "transform",
        action: { ...action, text: "[REDACTED]" },
        note: `Sensitive selector ${action.selector} — typed text masked before logging.`,
      };
    }
    const masked = redactSensitiveText(action.text);
    if (masked !== action.text) {
      return {
        kind: "transform",
        action: { ...action, text: masked },
        note: "Detected card / token-like substring; masked.",
      };
    }
  }

  return { kind: "allow", action };
};
