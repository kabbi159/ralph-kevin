// Sensitive-value redaction. Used by the runner to mask payment/credentials
// before logging an event, and by the recorder to mask DOM nodes before
// writing screenshots/replay.

const CC_PATTERNS = [
  /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, // 16-digit card
  /\b\d{4}[ -]?\d{6}[ -]?\d{5}\b/g, // 15-digit Amex
];
const CVV_PATTERN = /\b\d{3,4}\b/g;
const TOKEN_LIKE_PATTERN = /\b(?:sk|pk|tok|key|api|bearer)[_-]?[A-Za-z0-9_-]{16,}\b/gi;

export const REDACTED = "[REDACTED]";

export const redactSensitiveText = (text: string, opts: { aggressive?: boolean } = {}): string => {
  let out = text;
  for (const re of CC_PATTERNS) out = out.replace(re, REDACTED);
  out = out.replace(TOKEN_LIKE_PATTERN, REDACTED);
  if (opts.aggressive) {
    // Heuristically redact 3-4 digit sequences anywhere in the string. Off
    // by default — most numeric runs in commerce flows (prices, quantities)
    // are non-sensitive.
    out = out.replace(CVV_PATTERN, REDACTED);
  }
  return out;
};

const SENSITIVE_FIELD_HINTS = [
  "password",
  "passwd",
  "card",
  "cardnumber",
  "creditcard",
  "cvv",
  "cvc",
  "securitycode",
  "ssn",
  "social",
  "otp",
  "code",
  "pin",
  "token",
  "auth",
  "secret",
];

export const isSensitiveSelector = (selector: string | undefined): boolean => {
  if (!selector) return false;
  const s = selector.toLowerCase();
  return SENSITIVE_FIELD_HINTS.some((h) => s.includes(h));
};
