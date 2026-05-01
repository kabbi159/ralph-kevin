# Persona Data Layer Spec

## Goal

PersonaBench must use dataset-grounded personas.

The persona data layer should allow:

1. OSS users to connect directly to Nemotron-Personas datasets.
2. Hosted product users to search a pre-indexed persona store.
3. Enterprise users to use private or custom persona records.

## Sources

Open-source product:

- `MockPersonaSource`: for tests only.
- `LocalJsonPersonaSource`: reads normalized records from a local JSON/NDJSON file.
- `HuggingFaceNemotronSource`: streams from `nvidia/Nemotron-Personas-*` datasets via the HF API.
- `LocalParquetNemotronSource`: reads downloaded parquet shards via DuckDB (primary local engine).

Hosted product (separate commercialization track):

- `HostedVectorPersonaSource`: API client for hosted persona vector search at scale.

## Verification scope

The persona data layer must support every `nvidia/Nemotron-Personas-*` locale dataset (Korea, USA, Japan, India, Singapore, Brazil, France) at the schema, source-adapter, and normalizer level. No locale-specific code branches.

During this build, automated verification targets only `nvidia/Nemotron-Personas-Korea`:

- Local fixture snapshots, NDJSON test data, the example checkout demo, and browser smoke runs all use Korea data.
- Normalizer/compiler unit tests use Korea rows as the canonical input.
- Other locales are exercised by code (the source adapter accepts any locale dataset id) but not by automated tests.

Tests must avoid locale-specific assumptions (hardcoded language strings, region names, fixed province lists) so other locales can be onboarded later by extending fixtures only — no code change required.

Rationale: a time-boxed build needs a tight verification surface; one locale end-to-end is enough to prove the pipeline. Locale support shipping in code without per-locale tests is a deliberate, documented choice — not an unfinished task.

## Source interface

```ts
export interface PersonaSource {
  id: string;
  kind: "mock" | "local_json" | "local_parquet" | "huggingface" | "hosted_vector";

  search(query: PersonaSearchQuery): Promise<PersonaSearchResult>;
  sample(config: PersonaSamplingConfig): Promise<PersonaRecord[]>;
  getById(id: string): Promise<PersonaRecord | null>;
}
```

## Persona search query

```ts
export type PersonaSearchQuery = {
  textQuery?: string;

  source?: {
    provider?: "nvidia" | "custom";
    dataset?: string;
    revision?: string;
  };

  locale?: {
    country?: string;
    language?: string;
    province?: string[];
    district?: string[];
  };

  demographics?: {
    ageMin?: number;
    ageMax?: number;
    sex?: string[];
    maritalStatus?: string[];
    familyType?: string[];
    housingType?: string[];
    educationLevel?: string[];
    occupation?: string[];
  };

  uxTraits?: {
    digitalLiteracy?: [number, number];
    priceSensitivity?: [number, number];
    riskAversion?: [number, number];
    patience?: [number, number];
    detailOrientation?: [number, number];
    trustSensitivity?: [number, number];
  };

  sampleSize?: number;
  diversityBy?: Array<"age" | "region" | "occupation" | "educationLevel">;
};
```

## Normalized persona record

```ts
export type PersonaRecord = {
  id: string;

  source: {
    provider: "nvidia" | "custom" | "mock";
    dataset: string;
    datasetRevision?: string;
    rowId?: string;
    license?: string;
    attribution?: string;
  };

  locale: {
    country?: string;
    language?: string;
    province?: string;
    district?: string;
  };

  demographics: {
    age?: number;
    sex?: string;
    maritalStatus?: string;
    familyType?: string;
    housingType?: string;
    educationLevel?: string;
    occupation?: string;
  };

  narratives: {
    persona?: string;
    professionalPersona?: string;
    culturalBackground?: string;
    skillsAndExpertise?: string;
    skillsAndExpertiseList?: string[];
    hobbiesAndInterests?: string;
    hobbiesAndInterestsList?: string[];
    travelPersona?: string;
    culinaryPersona?: string;
    familyPersona?: string;
    sportsPersona?: string;
    artsPersona?: string;
    careerGoalsAndAmbitions?: string;
    raw?: Record<string, unknown>;
  };

  derivedTraits?: {
    digitalLiteracy?: number;
    priceSensitivity?: number;
    riskAversion?: number;
    patience?: number;
    detailOrientation?: number;
    trustSensitivity?: number;
    mobileConfidence?: number;
  };

  embeddingText?: string;
};
```

## Locale-specific fields and the `raw` catch-all

`narratives.raw` (`Record<string, unknown>`) is the catch-all for fields that exist in some `nvidia/Nemotron-Personas-*` shards but are not first-class on `PersonaRecord`. The normalizer must:

- map every first-class field listed above when present in the source row
- copy unmapped source columns into `narratives.raw[<source_column_name>]` verbatim
- never drop a field silently

Korea-specific examples that land in `raw`:

- `military_status` — Korean conscription status; Korea shard only
- `bachelors_field` — Korean education taxonomy; meaning differs per locale

Future locale shards may introduce new locale-specific columns; they should also flow through `raw` without code changes. Tests must assert that unknown columns appear under `raw` rather than being silently dropped.

## Persona UX profile

Compiled from a `PersonaRecord`.

```ts
export type PersonaUXProfile = {
  personaId: string;
  displayName: string;
  sourceProvenance: PersonaRecord["source"];

  background: string;

  uxBehavior: {
    digitalConfidence: string;
    decisionStyle: string;
    likelyConcerns: string[];
    frictionTriggers: string[];
    trustSignals: string[];
    completionStyle: string;
  };

  taskBehaviorInstructions: {
    actNaturally: string;
    doNotOptimizeForTaskCompletion: string;
    verbalizeConfusion: string;
    abandonIfReasonable: string;
  };

  promptBlock: string;
};
```

## Persona compiler requirements

The compiler must:

- preserve provenance
- summarize only relevant UX behavior
- avoid stereotypes
- avoid sensitive inferences not present in the data
- not claim representativeness
- output a compact prompt block
- include task-specific concerns when product context is available

## Required persona system instruction

Every persona agent prompt must include:

```txt
You are not trying to pass the test.
You are trying to behave naturally as this persona would.
If the interface feels confusing, risky, untrustworthy, inaccessible, or too much effort, you may hesitate, backtrack, ask yourself questions, or abandon the task.
Do not invent abilities or preferences that contradict the persona record.
```

## OSS direct Hugging Face strategy

TypeScript can orchestrate persona selection, but Python is acceptable for dataset loading.

Recommended path:

```txt
packages/personas
  src/sources/huggingface-source.ts
  python/hf_sample_personas.py
```

The TypeScript source adapter can spawn:

```bash
python packages/personas/python/hf_sample_personas.py \
  --dataset nvidia/Nemotron-Personas-Korea \
  --query "price-sensitive shopper" \
  --sample 5 \
  --output ndjson
```

The Python helper should:

- load the dataset
- stream or sample rows
- apply simple metadata filters
- emit normalized NDJSON
- include dataset id and row id
- fail gracefully if dataset access is unavailable

## Hosted vector search strategy

Hosted product pipeline:

```txt
HF dataset
  -> raw parquet snapshot
  -> normalizer
  -> embedding text builder
  -> embedding model
  -> pgvector / Qdrant
  -> metadata index
  -> search API
```

## Embedding text builder

Use a UX-focused text representation:

```txt
Country:
Region:
Age:
Occupation:
Education:
Family:
Housing:

Core persona:
Professional context:
Cultural background:
Skills:
Hobbies:
Goals:
Consumer/lifestyle hints:
```

## Persona packs

Persona packs are reusable sets of persona records.

```ts
export type PersonaPack = {
  id: string;
  name: string;
  description: string;

  source: {
    datasets: string[];
    searchQuery: PersonaSearchQuery;
  };

  personas: PersonaRecord[];

  coverage: {
    size: number;
    countries: string[];
    ageDistribution?: Record<string, number>;
    regionDistribution?: Record<string, number>;
    occupationDistribution?: Record<string, number>;
  };
};
```

Examples:

- Korean Checkout Risk Pack
- Japan Senior Onboarding Pack
- India Mobile Payment Pack
- US SMB Admin Pack
- Singapore Multilingual Service Pack

## Provenance in reports

Every report should include:

```txt
Persona source: <dataset>
Dataset revision: <revision or unknown>
Row ID: <row id or uuid>
License: <license>
Generated UX profile: derived summary, not original human data
```
