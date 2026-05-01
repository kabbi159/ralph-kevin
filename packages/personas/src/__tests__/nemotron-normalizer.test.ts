import { describe, expect, it } from "vitest";
import { normalizeNemotronRow } from "../normalizers/nemotron";

const KOREA_CONTEXT = {
  dataset: "nvidia/Nemotron-Personas-Korea",
  datasetRevision: "main",
  license: "CC-BY-4.0",
  attribution: "NVIDIA Nemotron-Personas-Korea",
};

// Mimics one parquet row as DuckDB delivers it (BIGINT age, list columns as
// JSON-encoded VARCHAR, military_status / bachelors_field as VARCHAR).
const koreaRow: Record<string, unknown> = {
  uuid: "00000000-0000-0000-0000-000000000abc",
  persona: "판타지/웹툰 콘텐츠를 즐기는 학생.",
  professional_persona: "디자인 전공 1학년.",
  cultural_background: "K-pop, 인디 게임 커뮤니티.",
  skills_and_expertise: "Figma, Procreate.",
  skills_and_expertise_list: '["figma","procreate","ui sketching"]',
  hobbies_and_interests: "판타지 웹소설, 일러스트, 오버워치.",
  hobbies_and_interests_list: '["판타지 웹소설","일러스트","게임"]',
  travel_persona: "친구들과 1박2일.",
  culinary_persona: "분식, 디저트.",
  family_persona: "주말 가족식사.",
  sports_persona: "산책 정도.",
  arts_persona: "디지털 아트 입문.",
  career_goals_and_ambitions: "캐릭터 디자이너로 게임 회사 입사.",
  age: 19n, // BIGINT from DuckDB
  sex: "F",
  marital_status: "single",
  family_type: "single_household",
  housing_type: "apartment",
  education_level: "university_in_progress",
  occupation: "student",
  district: "강남구",
  province: "서울특별시",
  country: "KR",
  // Korea-specific raw catch-all targets
  military_status: "면제 (여성)",
  bachelors_field: "디자인",
};

describe("normalizeNemotronRow", () => {
  it("maps a Korea row onto every expected first-class field", () => {
    const r = normalizeNemotronRow(koreaRow, KOREA_CONTEXT);
    expect(r.id).toBe(
      "nemotron:nvidia/Nemotron-Personas-Korea:00000000-0000-0000-0000-000000000abc",
    );
    expect(r.source.provider).toBe("nvidia");
    expect(r.source.dataset).toBe("nvidia/Nemotron-Personas-Korea");
    expect(r.source.rowId).toBe("00000000-0000-0000-0000-000000000abc");
    expect(r.source.license).toBe("CC-BY-4.0");
    expect(r.locale.country).toBe("KR");
    expect(r.locale.province).toBe("서울특별시");
    expect(r.locale.district).toBe("강남구");
    expect(r.demographics.age).toBe(19);
    expect(r.demographics.sex).toBe("F");
    expect(r.demographics.occupation).toBe("student");
    expect(r.narratives.persona).toBe("판타지/웹툰 콘텐츠를 즐기는 학생.");
    expect(r.narratives.skillsAndExpertiseList).toEqual(["figma", "procreate", "ui sketching"]);
    expect(r.narratives.hobbiesAndInterestsList).toEqual(["판타지 웹소설", "일러스트", "게임"]);
  });

  it("routes Korea-specific columns into narratives.raw without dropping them", () => {
    const r = normalizeNemotronRow(koreaRow, KOREA_CONTEXT);
    expect(r.narratives.raw).toBeDefined();
    expect(r.narratives.raw?.military_status).toBe("면제 (여성)");
    expect(r.narratives.raw?.bachelors_field).toBe("디자인");
  });

  it("preserves arbitrary unknown future columns through narratives.raw", () => {
    const futureRow = {
      ...koreaRow,
      // hypothetical V2 columns the spec hasn't yet added
      gen_z_subculture: "K-fantasy",
      preferred_payment_method: "kakaopay",
      hypothetical_locale_column_v2: { foo: 1, bar: ["a", "b"] },
    };
    const r = normalizeNemotronRow(futureRow, KOREA_CONTEXT);
    expect(r.narratives.raw?.gen_z_subculture).toBe("K-fantasy");
    expect(r.narratives.raw?.preferred_payment_method).toBe("kakaopay");
    expect(r.narratives.raw?.hypothetical_locale_column_v2).toEqual({
      foo: 1,
      bar: ["a", "b"],
    });
  });

  it("converts DuckDB BIGINT age to a JS number", () => {
    const r = normalizeNemotronRow({ ...koreaRow, age: 65n }, KOREA_CONTEXT);
    expect(typeof r.demographics.age).toBe("number");
    expect(r.demographics.age).toBe(65);
  });

  it("parses list columns from JSON, falls back to comma-split, drops empty", () => {
    const r1 = normalizeNemotronRow(
      { ...koreaRow, skills_and_expertise_list: "figma, sketch, procreate" },
      KOREA_CONTEXT,
    );
    expect(r1.narratives.skillsAndExpertiseList).toEqual(["figma", "sketch", "procreate"]);

    const r2 = normalizeNemotronRow({ ...koreaRow, skills_and_expertise_list: "" }, KOREA_CONTEXT);
    expect(r2.narratives.skillsAndExpertiseList).toBeUndefined();

    const r3 = normalizeNemotronRow(
      { ...koreaRow, skills_and_expertise_list: ["a", "b"] },
      KOREA_CONTEXT,
    );
    expect(r3.narratives.skillsAndExpertiseList).toEqual(["a", "b"]);
  });

  it("tolerates rows with missing optional columns", () => {
    const sparse: Record<string, unknown> = {
      uuid: "row-2",
      persona: "단일 컬럼만 있는 페르소나.",
      age: 30n,
      country: "KR",
    };
    const r = normalizeNemotronRow(sparse, KOREA_CONTEXT);
    expect(r.demographics.age).toBe(30);
    expect(r.locale.country).toBe("KR");
    expect(r.narratives.persona).toBe("단일 컬럼만 있는 페르소나.");
  });

  it("populates embeddingText with the canonical UX template", () => {
    const r = normalizeNemotronRow(koreaRow, KOREA_CONTEXT);
    expect(r.embeddingText).toBeDefined();
    expect(r.embeddingText).toContain("Country: KR");
    expect(r.embeddingText).toContain("Age: 19");
    expect(r.embeddingText).toContain("Occupation: student");
    expect(r.embeddingText).toContain("Core persona:");
    expect(r.embeddingText).toContain("Hobbies:");
  });

  it("throws a descriptive error when validation fails (negative age)", () => {
    const bad = { ...koreaRow, age: -1n };
    expect(() => normalizeNemotronRow(bad, KOREA_CONTEXT)).toThrow(/demographics\.age/);
  });

  it("is locale-agnostic: a synthetic non-Korea row routes everything correctly", () => {
    const usaRow: Record<string, unknown> = {
      uuid: "us-001",
      persona: "Mid-career PM at a B2B SaaS shop.",
      age: 34n,
      sex: "M",
      country: "US",
      language: "en",
      province: "California",
      district: "San Francisco",
      occupation: "product_manager",
      // hypothetical USA-specific column we don't yet have a first-class field for
      ssn_last_four: "1234",
    };
    const r = normalizeNemotronRow(usaRow, {
      dataset: "nvidia/Nemotron-Personas-USA",
    });
    expect(r.locale.country).toBe("US");
    expect(r.locale.language).toBe("en");
    expect(r.demographics.age).toBe(34);
    expect(r.narratives.raw?.ssn_last_four).toBe("1234");
    expect(r.id).toMatch(/^nemotron:nvidia\/Nemotron-Personas-USA:us-001$/);
  });
});
