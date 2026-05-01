import { PersonaRecordSchema } from "@personabench/core";
import { describe, expect, it } from "vitest";
import { MOCK_FIXTURES, MockPersonaSource } from "../sources/mock-source";

describe("MockPersonaSource", () => {
  it("ships at least 5 fixture personas, all valid PersonaRecord", () => {
    expect(MOCK_FIXTURES.length).toBeGreaterThanOrEqual(5);
    for (const record of MOCK_FIXTURES) {
      expect(() => PersonaRecordSchema.parse(record)).not.toThrow();
    }
  });

  it("every fixture is explicitly mock-provider with mock_ id prefix (AGENTS.md provenance rule)", () => {
    for (const record of MOCK_FIXTURES) {
      expect(record.source.provider).toBe("mock");
      expect(record.id.startsWith("mock_")).toBe(true);
    }
  });

  it("fixtures span diverse demographics (age 19-67, multiple regions, multiple occupations)", () => {
    const ages = MOCK_FIXTURES.map((r) => r.demographics.age ?? -1);
    expect(Math.min(...ages)).toBeLessThanOrEqual(20);
    expect(Math.max(...ages)).toBeGreaterThanOrEqual(60);
    const provinces = new Set(MOCK_FIXTURES.map((r) => r.locale.province));
    expect(provinces.size).toBeGreaterThanOrEqual(3);
    const occupations = new Set(MOCK_FIXTURES.map((r) => r.demographics.occupation));
    expect(occupations.size).toBeGreaterThanOrEqual(4);
  });

  it("search filters by demographics.age range", async () => {
    const src = new MockPersonaSource();
    const result = await src.search({ demographics: { ageMin: 40, ageMax: 65 } });
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    for (const r of result.matches) {
      const age = r.demographics.age ?? -1;
      expect(age).toBeGreaterThanOrEqual(40);
      expect(age).toBeLessThanOrEqual(65);
    }
  });

  it("search filters by textQuery substring (case-insensitive, any-word match)", async () => {
    const src = new MockPersonaSource();
    const r1 = await src.search({ textQuery: "디자이너" });
    expect(r1.matches.length).toBeGreaterThanOrEqual(1);
    const r2 = await src.search({ textQuery: "ENGINEER" });
    expect(r2.matches.some((r) => r.demographics.occupation?.includes("engineer"))).toBe(true);
  });

  it("search filters by locale.province", async () => {
    const src = new MockPersonaSource();
    const r = await src.search({ locale: { province: ["부산광역시"] } });
    expect(r.matches.length).toBeGreaterThanOrEqual(1);
    expect(r.matches.every((p) => p.locale.province === "부산광역시")).toBe(true);
  });

  it("sample respects sampleSize", async () => {
    const src = new MockPersonaSource();
    const r = await src.sample({ sampleSize: 2 });
    expect(r).toHaveLength(2);
  });

  it("getById returns null for an unknown id", async () => {
    const src = new MockPersonaSource();
    expect(await src.getById("mock_does_not_exist")).toBeNull();
  });

  it("getById returns the matching fixture for a known id", async () => {
    const src = new MockPersonaSource();
    const got = await src.getById("mock_kr_19_design");
    expect(got).not.toBeNull();
    expect(got?.demographics.age).toBe(19);
  });
});
