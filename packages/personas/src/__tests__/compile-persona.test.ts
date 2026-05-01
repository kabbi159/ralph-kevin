import type { PersonaRecord } from "@personabench/core";
import { describe, expect, it } from "vitest";
import { compilePersona } from "../compiler/compile-persona";
import { REQUIRED_SYSTEM_INSTRUCTION } from "../compiler/prompt-templates";
import { normalizeNemotronRow } from "../normalizers/nemotron";

const koreaRow = {
  uuid: "row-12345",
  persona: "판타지/웹툰 콘텐츠를 즐기는 학생.",
  professional_persona: "디자인 전공 1학년.",
  age: 19n,
  sex: "F",
  occupation: "student",
  country: "KR",
  province: "서울특별시",
  district: "강남구",
  military_status: "면제 (여성)",
  bachelors_field: "디자인",
};

const koreaCtx = {
  dataset: "nvidia/Nemotron-Personas-Korea",
  datasetRevision: "main",
  license: "CC-BY-4.0",
};

describe("compilePersona", () => {
  it("turns a Korea record into a valid PersonaUXProfile", () => {
    const r = normalizeNemotronRow(koreaRow, koreaCtx);
    // attach realistic derivedTraits to drive the conditional branches
    r.derivedTraits = {
      digitalLiteracy: 5,
      priceSensitivity: 4,
      patience: 2,
      trustSensitivity: 4,
      mobileConfidence: 5,
    };
    const profile = compilePersona(r);
    expect(profile.personaId).toBe("nemotron:nvidia/Nemotron-Personas-Korea:row-12345");
    expect(profile.displayName).toContain("19");
    expect(profile.displayName).toContain("student");
    expect(profile.background.length).toBeGreaterThan(20);
    expect(profile.uxBehavior.likelyConcerns.length).toBeGreaterThanOrEqual(1);
    expect(profile.uxBehavior.frictionTriggers.length).toBeGreaterThanOrEqual(1);
  });

  it("preserves provenance verbatim through sourceProvenance", () => {
    const r = normalizeNemotronRow(koreaRow, koreaCtx);
    const p = compilePersona(r);
    expect(p.sourceProvenance.provider).toBe("nvidia");
    expect(p.sourceProvenance.dataset).toBe("nvidia/Nemotron-Personas-Korea");
    expect(p.sourceProvenance.rowId).toBe("row-12345");
    expect(p.sourceProvenance.license).toBe("CC-BY-4.0");
  });

  it("includes the required system instruction VERBATIM in promptBlock", () => {
    const r = normalizeNemotronRow(koreaRow, koreaCtx);
    const p = compilePersona(r);
    expect(p.promptBlock).toContain(REQUIRED_SYSTEM_INSTRUCTION);
  });

  it("never invents an occupation when the source row has none", () => {
    const sparseRow = {
      uuid: "row-sparse",
      persona: "Just a person.",
      age: 30n,
      country: "KR",
    };
    const r = normalizeNemotronRow(sparseRow, koreaCtx);
    const p = compilePersona(r);
    // occupation is missing; it must not appear in promptBlock or background
    expect(p.background.toLowerCase()).not.toMatch(/student|engineer|designer|manager/);
    expect(p.promptBlock.toLowerCase()).not.toMatch(/i am a student|i am an engineer/);
  });

  it("does not make representativeness claims (no 'typical' or 'average user' phrasing)", () => {
    const r = normalizeNemotronRow(koreaRow, koreaCtx);
    const p = compilePersona(r);
    const banned = [
      "typical user",
      "average user",
      "all users",
      "real customer",
      "typical customer",
    ];
    for (const phrase of banned) {
      expect(p.promptBlock.toLowerCase()).not.toContain(phrase);
    }
  });

  it("renders task context when provided", () => {
    const r = normalizeNemotronRow(koreaRow, koreaCtx);
    const p = compilePersona(r, {
      productSummary: "Korean checkout demo with intentional UX defects.",
      task: "Complete checkout up to confirmation; do not pay for real.",
      successCriteria: ["Find the final total.", "Identify the next CTA."],
    });
    expect(p.promptBlock).toContain("Task context");
    expect(p.promptBlock).toContain("checkout demo");
    expect(p.promptBlock).toContain("Find the final total.");
  });

  it("derives traits differently for high vs low priceSensitivity", () => {
    const base: PersonaRecord = normalizeNemotronRow(koreaRow, koreaCtx);
    const highPrice = compilePersona({
      ...base,
      derivedTraits: { priceSensitivity: 5, riskAversion: 5, trustSensitivity: 5 },
    });
    const lowPrice = compilePersona({
      ...base,
      derivedTraits: { priceSensitivity: 1, riskAversion: 1, trustSensitivity: 1 },
    });
    // high-price persona must mention hidden / shipping / approximate costs
    const highHay = highPrice.uxBehavior.frictionTriggers.join(" ").toLowerCase();
    expect(highHay).toMatch(/approximate|shipping|cost/);
    // low-price persona's frictionTriggers should not include the price-specific ones
    const lowHay = lowPrice.uxBehavior.frictionTriggers.join(" ").toLowerCase();
    expect(lowHay).not.toMatch(/approximate|shipping|cost/);
  });

  it("is locale-agnostic: works on a US/EN record without Korea-specific assumptions", () => {
    const usRow = {
      uuid: "us-001",
      persona: "Mid-career PM at a B2B SaaS shop.",
      age: 34n,
      sex: "M",
      country: "US",
      language: "en",
      province: "California",
      district: "San Francisco",
      occupation: "product_manager",
    };
    const r = normalizeNemotronRow(usRow, { dataset: "nvidia/Nemotron-Personas-USA" });
    r.derivedTraits = { digitalLiteracy: 5, priceSensitivity: 2 };
    const p = compilePersona(r);
    expect(p.sourceProvenance.dataset).toBe("nvidia/Nemotron-Personas-USA");
    expect(p.displayName).toContain("product_manager");
    expect(p.promptBlock).toContain(REQUIRED_SYSTEM_INSTRUCTION);
    // No Korea-specific text should appear
    expect(p.promptBlock).not.toContain("서울");
    expect(p.promptBlock).not.toContain("KRW");
  });
});
