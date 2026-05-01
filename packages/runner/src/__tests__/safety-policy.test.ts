import { describe, expect, it } from "vitest";
import { checkAction } from "../safety/policy";
import { isSensitiveSelector, redactSensitiveText } from "../safety/redact";

const obs = (
  refs: Array<{ selector: string; role?: string; label?: string }> = [],
  origin = "http://localhost:3100",
) => ({
  origin,
  refs: refs.map((r) => r.selector.replace(/^@/, "")),
  visibleText: undefined,
  interactiveElements: refs,
});

describe("safety/checkAction — domain allowlist", () => {
  it("blocks an action when origin is outside the allowlist", () => {
    const r = checkAction(
      { type: "click", selector: "@e1", reason: "x" },
      {
        allowedDomains: ["localhost"],
        blockPaymentSubmission: true,
        blockDestructiveActions: true,
        redactSensitiveFields: true,
        observation: obs([{ selector: "@e1", label: "ok" }], "https://evil.example.com"),
      },
    );
    expect(r.kind).toBe("block");
    if (r.kind === "block") expect(r.reason).toBe("domain_not_allowed");
  });

  it("allows when origin matches a sub-domain of an allowlist entry", () => {
    const r = checkAction(
      { type: "click", selector: "@e1", reason: "x" },
      {
        allowedDomains: ["wrtn.ai"],
        blockPaymentSubmission: false,
        blockDestructiveActions: false,
        redactSensitiveFields: false,
        observation: obs([{ selector: "@e1", label: "ok" }], "https://crack.wrtn.ai"),
      },
    );
    expect(r.kind).toBe("allow");
  });

  it("allows when there is no observation/origin yet (first navigation)", () => {
    const r = checkAction(
      { type: "click", selector: "@e1", reason: "x" },
      {
        allowedDomains: ["localhost"],
        blockPaymentSubmission: false,
        blockDestructiveActions: false,
        redactSensitiveFields: false,
      },
    );
    expect(r.kind).toBe("allow");
  });
});

describe("safety/checkAction — payment block", () => {
  it("blocks a click on a button labeled '결제 확정' when blockPaymentSubmission is true", () => {
    const r = checkAction(
      { type: "click", selector: "@e8", reason: "submit pay" },
      {
        allowedDomains: ["localhost"],
        blockPaymentSubmission: true,
        blockDestructiveActions: true,
        redactSensitiveFields: true,
        observation: obs([{ selector: "@e8", role: "button", label: "결제 확정" }]),
      },
    );
    expect(r.kind).toBe("block");
    if (r.kind === "block") expect(r.reason).toBe("payment_blocked");
  });

  it("blocks a click on a button labeled 'Place Order' (English)", () => {
    const r = checkAction(
      { type: "click", selector: "@e9", reason: "submit pay" },
      {
        allowedDomains: ["localhost"],
        blockPaymentSubmission: true,
        blockDestructiveActions: false,
        redactSensitiveFields: false,
        observation: obs([{ selector: "@e9", role: "button", label: "Place Order" }]),
      },
    );
    expect(r.kind).toBe("block");
    if (r.kind === "block") expect(r.reason).toBe("payment_blocked");
  });

  it("does not block on payment-adjacent labels like '결제 정보 입력'", () => {
    const r = checkAction(
      { type: "click", selector: "@e10", reason: "open form" },
      {
        allowedDomains: ["localhost"],
        blockPaymentSubmission: true,
        blockDestructiveActions: true,
        redactSensitiveFields: false,
        observation: obs([{ selector: "@e10", role: "button", label: "결제 정보 입력" }]),
      },
    );
    expect(r.kind).toBe("allow");
  });

  it("respects blockPaymentSubmission=false (off-by-explicit-config)", () => {
    const r = checkAction(
      { type: "click", selector: "@e8", reason: "submit pay" },
      {
        allowedDomains: ["localhost"],
        blockPaymentSubmission: false,
        blockDestructiveActions: false,
        redactSensitiveFields: false,
        observation: obs([{ selector: "@e8", role: "button", label: "결제 확정" }]),
      },
    );
    expect(r.kind).toBe("allow");
  });
});

describe("safety/checkAction — destructive action block", () => {
  it("blocks a click on '계정 삭제' when blockDestructiveActions is true", () => {
    const r = checkAction(
      { type: "click", selector: "@e20", reason: "x" },
      {
        allowedDomains: ["localhost"],
        blockPaymentSubmission: false,
        blockDestructiveActions: true,
        redactSensitiveFields: false,
        observation: obs([{ selector: "@e20", role: "button", label: "계정 삭제" }]),
      },
    );
    expect(r.kind).toBe("block");
    if (r.kind === "block") expect(r.reason).toBe("destructive_blocked");
  });
});

describe("safety/checkAction — typed-text redaction", () => {
  it("masks typed text on a sensitive-named selector", () => {
    const r = checkAction(
      { type: "type", selector: "input[name=password]", text: "hunter2", reason: "x" },
      {
        allowedDomains: ["localhost"],
        blockPaymentSubmission: false,
        blockDestructiveActions: false,
        redactSensitiveFields: true,
      },
    );
    expect(r.kind).toBe("transform");
    if (r.kind === "transform" && r.action.type === "type") {
      expect(r.action.text).toBe("[REDACTED]");
    }
  });

  it("masks typed text containing a credit card pattern", () => {
    const r = checkAction(
      { type: "type", selector: "@e_cc", text: "My card 4111 1111 1111 1111 ok?", reason: "x" },
      {
        allowedDomains: ["localhost"],
        blockPaymentSubmission: false,
        blockDestructiveActions: false,
        redactSensitiveFields: true,
      },
    );
    expect(r.kind).toBe("transform");
    if (r.kind === "transform" && r.action.type === "type") {
      expect(r.action.text).not.toContain("4111");
      expect(r.action.text).toContain("[REDACTED]");
    }
  });

  it("does not transform a benign typed text", () => {
    const r = checkAction(
      { type: "type", selector: "@e_search", text: "wireless earbuds", reason: "x" },
      {
        allowedDomains: ["localhost"],
        blockPaymentSubmission: false,
        blockDestructiveActions: false,
        redactSensitiveFields: true,
      },
    );
    expect(r.kind).toBe("allow");
  });
});

describe("redact helpers", () => {
  it("redacts API/token-like substrings", () => {
    const masked = redactSensitiveText("Set sk_live_ABCDEFGH1234567890XYZ in env");
    expect(masked).toContain("[REDACTED]");
    expect(masked).not.toContain("sk_live_ABCDEFGH1234567890XYZ");
  });

  it("isSensitiveSelector recognizes password / cvv / token / pin", () => {
    expect(isSensitiveSelector("input[name=password]")).toBe(true);
    expect(isSensitiveSelector("input#cvv")).toBe(true);
    expect(isSensitiveSelector("input[name=otp]")).toBe(true);
    expect(isSensitiveSelector("input[name=email]")).toBe(false);
    expect(isSensitiveSelector(undefined)).toBe(false);
  });
});
