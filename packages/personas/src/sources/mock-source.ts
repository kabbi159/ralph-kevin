import type { PersonaRecord, PersonaSearchQuery } from "@personabench/core";
import type { PersonaSamplingConfig, PersonaSearchResult, PersonaSource } from "./persona-source";

// MockPersonaSource — fixture-only persona source for tests of higher layers.
// Every record carries source.provider="mock" and an id prefixed with `mock_`,
// per the AGENTS.md rule that mock personas are never presented as
// data-grounded.

const FIXTURES: PersonaRecord[] = [
  {
    id: "mock_kr_19_design",
    source: { provider: "mock", dataset: "fixture/checkout-mock-v1" },
    locale: { country: "KR", language: "ko", province: "서울특별시", district: "강남구" },
    demographics: {
      age: 19,
      sex: "F",
      maritalStatus: "single",
      educationLevel: "university_in_progress",
      occupation: "student",
      housingType: "apartment",
    },
    narratives: {
      persona: "판타지/웹툰 콘텐츠를 즐기는 19세 학생, 가격 변동에 민감.",
      hobbiesAndInterestsList: ["판타지 웹소설", "일러스트", "게임"],
    },
    derivedTraits: {
      digitalLiteracy: 5,
      priceSensitivity: 5,
      patience: 2,
      trustSensitivity: 4,
      mobileConfidence: 5,
    },
  },
  {
    id: "mock_kr_55_smb_owner",
    source: { provider: "mock", dataset: "fixture/checkout-mock-v1" },
    locale: { country: "KR", language: "ko", province: "경기도", district: "수원시" },
    demographics: {
      age: 55,
      sex: "F",
      maritalStatus: "married",
      educationLevel: "high_school",
      occupation: "small_business_owner",
      housingType: "apartment",
    },
    narratives: {
      persona: "수원에서 작은 카페를 운영. 모바일 결제는 익숙하지만 숨겨진 비용에 매우 민감.",
    },
    derivedTraits: {
      digitalLiteracy: 3,
      priceSensitivity: 5,
      riskAversion: 4,
      patience: 3,
      mobileConfidence: 4,
    },
  },
  {
    id: "mock_kr_42_eng_dad",
    source: { provider: "mock", dataset: "fixture/checkout-mock-v1" },
    locale: { country: "KR", language: "ko", province: "서울특별시", district: "마포구" },
    demographics: {
      age: 42,
      sex: "M",
      maritalStatus: "married",
      familyType: "two_child_family",
      educationLevel: "university",
      occupation: "software_engineer",
    },
    narratives: {
      persona: "두 자녀를 둔 마포 거주 개발자. 빠른 결제 흐름을 원하지만 환불 정책을 꼭 확인.",
    },
    derivedTraits: {
      digitalLiteracy: 5,
      priceSensitivity: 3,
      riskAversion: 3,
      patience: 4,
      detailOrientation: 5,
      mobileConfidence: 5,
    },
  },
  {
    id: "mock_kr_67_retiree",
    source: { provider: "mock", dataset: "fixture/checkout-mock-v1" },
    locale: { country: "KR", language: "ko", province: "부산광역시", district: "해운대구" },
    demographics: {
      age: 67,
      sex: "M",
      maritalStatus: "married",
      educationLevel: "university",
      occupation: "retired",
      housingType: "apartment",
    },
    narratives: {
      persona: "부산 해운대 거주 은퇴 교사. 모바일 글자가 작으면 멈춰 서서 다시 확인.",
    },
    derivedTraits: {
      digitalLiteracy: 2,
      priceSensitivity: 5,
      riskAversion: 5,
      patience: 4,
      mobileConfidence: 2,
    },
  },
  {
    id: "mock_kr_31_freelance_designer",
    source: { provider: "mock", dataset: "fixture/checkout-mock-v1" },
    locale: { country: "KR", language: "ko", province: "서울특별시", district: "성동구" },
    demographics: {
      age: 31,
      sex: "F",
      maritalStatus: "single",
      educationLevel: "university",
      occupation: "freelance_designer",
    },
    narratives: {
      persona: "성수동 1인 디자이너. 결제 흐름이 깔끔하면 즉시 결제하지만 의심이 들면 곧장 이탈.",
    },
    derivedTraits: {
      digitalLiteracy: 5,
      priceSensitivity: 4,
      riskAversion: 3,
      patience: 2,
      detailOrientation: 4,
      mobileConfidence: 5,
    },
  },
];

const matchesQuery = (p: PersonaRecord, q: PersonaSearchQuery): boolean => {
  if (q.demographics?.ageMin != null && (p.demographics.age ?? -1) < q.demographics.ageMin) {
    return false;
  }
  if (
    q.demographics?.ageMax != null &&
    (p.demographics.age ?? Number.MAX_SAFE_INTEGER) > q.demographics.ageMax
  ) {
    return false;
  }
  if (
    q.demographics?.sex &&
    p.demographics.sex &&
    !q.demographics.sex.includes(p.demographics.sex)
  ) {
    return false;
  }
  if (q.locale?.country && p.locale.country && q.locale.country !== p.locale.country) {
    return false;
  }
  if (
    q.locale?.province?.length &&
    p.locale.province &&
    !q.locale.province.includes(p.locale.province)
  ) {
    return false;
  }
  if (q.textQuery) {
    const haystack = [
      p.narratives.persona,
      p.narratives.professionalPersona,
      p.narratives.culturalBackground,
      p.narratives.hobbiesAndInterests,
      p.demographics.occupation,
    ]
      .filter((s): s is string => typeof s === "string")
      .join(" ")
      .toLowerCase();
    const needles = q.textQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((n) => n.length > 0);
    if (!needles.some((n) => haystack.includes(n))) {
      return false;
    }
  }
  return true;
};

export class MockPersonaSource implements PersonaSource {
  readonly id = "mock";
  readonly kind = "mock" as const;

  private readonly records: PersonaRecord[];

  constructor(records: PersonaRecord[] = FIXTURES) {
    this.records = records;
  }

  search(query: PersonaSearchQuery): Promise<PersonaSearchResult> {
    const start = Date.now();
    const matches = this.records.filter((r) => matchesQuery(r, query));
    return Promise.resolve({
      matches,
      totalEstimated: matches.length,
      sourceLatencyMs: Date.now() - start,
    });
  }

  async sample(config: PersonaSamplingConfig): Promise<PersonaRecord[]> {
    const found = config.query ? (await this.search(config.query)).matches : this.records.slice();
    return found.slice(0, config.sampleSize);
  }

  getById(id: string): Promise<PersonaRecord | null> {
    return Promise.resolve(this.records.find((r) => r.id === id) ?? null);
  }
}

export const MOCK_FIXTURES: ReadonlyArray<PersonaRecord> = FIXTURES;
