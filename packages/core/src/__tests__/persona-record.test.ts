import { describe, expect, it } from "vitest";
import { PersonaRecordSchema, PersonaSearchQuerySchema } from "../schemas";

// A representative Korea row in the shape the NemotronNormalizer (Phase 2) will
// produce. Keeping it inline rather than reaching into data/personas keeps the
// test offline and the assertion locale-agnostic — every locale-specific column
// (military_status, bachelors_field) flows through narratives.raw.
const koreaFixture = {
  id: "nemotron:Nemotron-Personas-Korea:row-12345",
  source: {
    provider: "nvidia" as const,
    dataset: "nvidia/Nemotron-Personas-Korea",
    datasetRevision: "main",
    rowId: "row-12345",
    license: "CC-BY-4.0",
    attribution: "NVIDIA Nemotron-Personas-Korea",
  },
  locale: {
    country: "KR",
    language: "ko",
    province: "서울특별시",
    district: "강남구",
  },
  demographics: {
    age: 19,
    sex: "F",
    maritalStatus: "single",
    familyType: "single_household",
    housingType: "apartment",
    educationLevel: "university_in_progress",
    occupation: "student",
  },
  narratives: {
    persona: "판타지/웹툰 콘텐츠를 즐기는 19세 학생.",
    professionalPersona: "디자인 전공 1학년.",
    culturalBackground: "K-pop, 인디 게임 커뮤니티 활발히 참여.",
    skillsAndExpertise: "Figma, Procreate.",
    skillsAndExpertiseList: ["figma", "procreate", "ui sketching"],
    hobbiesAndInterests: "판타지 웹소설, 일러스트, 오버워치.",
    hobbiesAndInterestsList: ["판타지 웹소설", "일러스트", "게임"],
    travelPersona: "친구들과 1박2일 짧은 여행 선호.",
    culinaryPersona: "분식·디저트 선호, 카페 투어.",
    familyPersona: "부모님과 떨어져 살지만 주말 가족식사.",
    sportsPersona: "운동은 피하는 편, 산책 정도.",
    artsPersona: "아이패드 디지털 아트 입문.",
    careerGoalsAndAmbitions: "캐릭터 디자이너로 게임 회사 입사.",
    raw: {
      military_status: "면제 (여성)",
      bachelors_field: "디자인",
      // intentionally unknown future column — must not be dropped:
      hypothetical_locale_column_v2: { foo: 1, bar: ["a", "b"] },
    },
  },
  derivedTraits: {
    digitalLiteracy: 5,
    priceSensitivity: 4,
    riskAversion: 2,
    patience: 2,
    detailOrientation: 3,
    trustSensitivity: 3,
    mobileConfidence: 5,
  },
  embeddingText: "Country: KR\nRegion: 서울 강남\nAge: 19\nOccupation: 학생\n…",
};

describe("PersonaRecordSchema", () => {
  it("accepts a Korea-shaped fixture and round-trips through JSON", () => {
    const parsed = PersonaRecordSchema.parse(koreaFixture);
    const reparsed = PersonaRecordSchema.parse(JSON.parse(JSON.stringify(parsed)));
    expect(reparsed).toEqual(parsed);
  });

  it("preserves provenance fields verbatim", () => {
    const parsed = PersonaRecordSchema.parse(koreaFixture);
    expect(parsed.source.provider).toBe("nvidia");
    expect(parsed.source.dataset).toBe("nvidia/Nemotron-Personas-Korea");
    expect(parsed.source.rowId).toBe("row-12345");
    expect(parsed.source.license).toBe("CC-BY-4.0");
  });

  it("preserves locale-specific raw columns (military_status, bachelors_field, future)", () => {
    const parsed = PersonaRecordSchema.parse(koreaFixture);
    expect(parsed.narratives.raw).toBeDefined();
    expect(parsed.narratives.raw?.military_status).toBe("면제 (여성)");
    expect(parsed.narratives.raw?.bachelors_field).toBe("디자인");
    expect(parsed.narratives.raw?.hypothetical_locale_column_v2).toEqual({
      foo: 1,
      bar: ["a", "b"],
    });
  });

  it("accepts the minimum surface (id + source + empty locale/demographics/narratives)", () => {
    const minimal = {
      id: "mock_1",
      source: { provider: "mock", dataset: "fixture/mock" },
      locale: {},
      demographics: {},
      narratives: {},
    };
    expect(() => PersonaRecordSchema.parse(minimal)).not.toThrow();
  });

  it("rejects invalid provider with descriptive error path", () => {
    const bad = {
      ...koreaFixture,
      source: { ...koreaFixture.source, provider: "nope-not-a-provider" },
    };
    const result = PersonaRecordSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue?.path).toEqual(["source", "provider"]);
    }
  });

  it("rejects negative age with descriptive error path", () => {
    const bad = {
      ...koreaFixture,
      demographics: { ...koreaFixture.demographics, age: -1 },
    };
    const result = PersonaRecordSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue?.path).toEqual(["demographics", "age"]);
    }
  });

  it("is locale-agnostic: synthetic English row routes unknown columns into raw", () => {
    const synthetic = {
      id: "custom:byo-en-1:0",
      source: { provider: "custom" as const, dataset: "byo-en-1" },
      locale: { country: "US", language: "en" },
      demographics: { age: 34, occupation: "product_manager" },
      narratives: {
        persona: "Mid-career PM at a B2B SaaS shop.",
        raw: {
          // arbitrary BYO columns must survive
          favorite_news_outlet: "Axios",
          experiments_attended: 17,
          some_nested: { tags: ["tools-fatigue", "ops"] },
        },
      },
    };
    const parsed = PersonaRecordSchema.parse(synthetic);
    expect(parsed.narratives.raw?.favorite_news_outlet).toBe("Axios");
    expect(parsed.narratives.raw?.experiments_attended).toBe(17);
    expect(parsed.narratives.raw?.some_nested).toEqual({ tags: ["tools-fatigue", "ops"] });
  });
});

describe("PersonaSearchQuerySchema", () => {
  it("accepts the checkout demo's persona query verbatim", () => {
    const q = {
      source: {
        provider: "nvidia" as const,
        dataset: "nvidia/Nemotron-Personas-Korea",
      },
      textQuery: "price-sensitive mobile shopper who checks hidden fees before paying",
      demographics: { ageMin: 40, ageMax: 65 },
      uxTraits: {
        priceSensitivity: [4, 5] as [number, number],
        riskAversion: [3, 5] as [number, number],
        digitalLiteracy: [1, 3] as [number, number],
      },
      sampleSize: 3,
      diversityBy: ["age", "region", "occupation"] as Array<
        "age" | "region" | "occupation" | "educationLevel"
      >,
    };
    expect(() => PersonaSearchQuerySchema.parse(q)).not.toThrow();
  });

  it("rejects ageMin > ageMax", () => {
    const q = { demographics: { ageMin: 50, ageMax: 30 } };
    const result = PersonaSearchQuerySchema.safeParse(q);
    expect(result.success).toBe(false);
  });

  it("accepts the crack live-site narrow age window (19-19)", () => {
    const q = {
      textQuery: "10대 후반 한국 신규 유저로 판타지·웹툰·스토리 콘텐츠에 몰입하는 사람",
      demographics: { ageMin: 19, ageMax: 19 },
      sampleSize: 3,
    };
    expect(() => PersonaSearchQuerySchema.parse(q)).not.toThrow();
  });

  it("accepts the empty query (no filters)", () => {
    expect(() => PersonaSearchQuerySchema.parse({})).not.toThrow();
  });

  it("rejects unknown diversityBy enum values", () => {
    const q = { diversityBy: ["age", "favorite_color"] };
    const result = PersonaSearchQuerySchema.safeParse(q);
    expect(result.success).toBe(false);
  });
});
