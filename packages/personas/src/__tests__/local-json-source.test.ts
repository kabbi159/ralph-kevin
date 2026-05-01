import { writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LocalJsonPersonaSource } from "../sources/local-json-source";

const REPO_ROOT = "/Users/kevin/ralph-kevin";
const BYO_EN_FIXTURE = `${REPO_ROOT}/packages/personas/fixtures/byo-en-1.ndjson`;

describe("LocalJsonPersonaSource (locale-agnostic, stretch S6)", () => {
  it("loads and validates a 1-row English NDJSON fixture", async () => {
    const src = new LocalJsonPersonaSource({ path: BYO_EN_FIXTURE });
    const r = await src.search({});
    expect(r.matches).toHaveLength(1);
    const persona = r.matches[0];
    expect(persona).toBeDefined();
    if (!persona) return;
    expect(persona.source.provider).toBe("custom");
    expect(persona.source.dataset).toBe("byo-en-1");
    expect(persona.locale.country).toBe("US");
    expect(persona.locale.language).toBe("en");
    expect(persona.demographics.age).toBe(34);
    expect(persona.narratives.raw?.favorite_news_outlet).toBe("Axios");
  });

  it("textQuery filters work case-insensitively across languages (English fixture)", async () => {
    const src = new LocalJsonPersonaSource({ path: BYO_EN_FIXTURE });
    const r1 = await src.search({ textQuery: "PRODUCT MANAGER" });
    expect(r1.matches.length).toBe(1);
    const r2 = await src.search({ textQuery: "designer" });
    expect(r2.matches.length).toBe(0);
  });

  it("filters by locale.country", async () => {
    const src = new LocalJsonPersonaSource({ path: BYO_EN_FIXTURE });
    const us = await src.search({ locale: { country: "US" } });
    expect(us.matches.length).toBe(1);
    const kr = await src.search({ locale: { country: "KR" } });
    expect(kr.matches.length).toBe(0);
  });

  it("getById resolves the fixture's id and returns null for unknown ids", async () => {
    const src = new LocalJsonPersonaSource({ path: BYO_EN_FIXTURE });
    const hit = await src.getById("custom:byo-en-1:row_001");
    expect(hit?.demographics.occupation).toBe("product_manager");
    expect(await src.getById("nope")).toBeNull();
  });

  it("rejects a malformed row with the row index and Zod issue path", () => {
    const dir = mkdtempSync(join(tmpdir(), "personabench-byo-bad-"));
    const path = join(dir, "bad.ndjson");
    try {
      // Row 0 is valid; row 1 omits the required `source.dataset`.
      writeFileSync(
        path,
        [
          JSON.stringify({
            id: "custom:byo:0",
            source: { provider: "custom", dataset: "byo" },
            locale: {},
            demographics: {},
            narratives: {},
          }),
          JSON.stringify({
            id: "custom:byo:1",
            source: { provider: "custom" }, // missing dataset
            locale: {},
            demographics: {},
            narratives: {},
          }),
        ].join("\n"),
      );
      expect(() => new LocalJsonPersonaSource({ path })).toThrow(/row 1/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("accepts a JSON-array fixture (not just NDJSON)", () => {
    const dir = mkdtempSync(join(tmpdir(), "personabench-byo-arr-"));
    const path = join(dir, "arr.json");
    try {
      writeFileSync(
        path,
        JSON.stringify([
          {
            id: "custom:byo:0",
            source: { provider: "custom", dataset: "byo-arr" },
            locale: {},
            demographics: {},
            narratives: {},
          },
          {
            id: "custom:byo:1",
            source: { provider: "custom", dataset: "byo-arr" },
            locale: { country: "JP" },
            demographics: { age: 50 },
            narratives: {},
          },
        ]),
      );
      const src = new LocalJsonPersonaSource({ path });
      return src.search({}).then((r) => {
        expect(r.matches).toHaveLength(2);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
