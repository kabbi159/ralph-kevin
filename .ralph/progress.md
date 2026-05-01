# Progress Log

Each iteration appends one block. Newest at the top.

---

## Iteration 10 — 2026-05-01 14:13 KST — TASK-013 LocalParquetNemotronSource (DuckDB)

**Pattern:** A (despite originally being scoped as B; the parquet schema was already mapped in iteration 7's probe and the SQL query shape is straightforward)

**What happened**

- `packages/personas/src/sources/duckdb-client.ts` — small DuckDB wrapper around `@duckdb/node-api` (NOT the legacy `duckdb` npm package). Exposes `getDuckDBInstance()` (singleton in-memory instance shared across sources), `runQuery(conn, sql, params)` with type-aware binders (boolean/bigint/integer/double/varchar/null), and `sanitizeBigInts(row)` that flattens DuckDB's BigInt return values to plain JS numbers before normalization.
- `packages/personas/src/sources/local-parquet-source.ts` — `LocalParquetNemotronSource` class implementing `PersonaSource`. `search()` builds a parameterized SQL WHERE from every PersonaSearchQuery field (age range, sex, marital status, education, occupation, country, province, district, multi-token textQuery LIKE across 7 narrative columns) and reads through `read_parquet('<rootDir>/data/train-*.parquet')`. `sample()` does bucket round-robin diversity sampling. `getById()` decodes `nemotron:<dataset>:<rowId>` → `WHERE uuid = ?`. Constructor throws when shards are missing so failures surface immediately with a `huggingface-cli download` hint.
- 10 vitest tests against the real Korea shards (skipped cleanly via `describe.skip` when the gitignored dataset is absent). All passing — including the load-bearing demo conditions: **age 40-65 → ≥3 matches**, **age 19-19 → ≥3 matches**, Korean `'판타지'` textQuery hits, getById round-trip, foreign-prefix getById returns null.

**Bug fixed in-iteration**

- Initial test asserted `textQuery: "price hidden"` on Korean narratives → 0 matches. The Korea shard is fully Korean; a Latin keyword is the wrong assertion. Replaced with two tests: a demographics-only baseline (≥3 matches at 40-65, the canonical demo persona window) plus a Korean-language smoke (`'가격'` runs cleanly, hit count not asserted).

**Gates**

- pnpm typecheck: pass (11 packages)
- pnpm lint: pass (97 files, 5 cosmetic auto-fixes)
- pnpm test: pass (core 57/57 + personas 36/36 = 93/93)

**Phase 2 status**

- TASK-010 ✓ TASK-011 ✓ TASK-012 ✓ TASK-013 ✓
- Demo path now has real Korean personas via DuckDB. TASK-014 (BYO JSON) and TASK-015 (HF) deferred to S6/stretch.

**Next iteration**

- Skip TASK-014/015 (deferred). Jump to TASK-016 (Phase 2 boundary, Pattern C with phase-tester + spec-reviewer + dataset-validator) — but also could move directly to Phase 3 (runner) given time pressure. Decision next iteration.

---

## Iteration 9 — 2026-05-01 14:09 KST — TASK-012 PersonaCompiler

**Pattern:** A

**What happened**

- `packages/personas/src/compiler/prompt-templates.ts` — `REQUIRED_SYSTEM_INSTRUCTION` (the docs/03 §Required persona system instruction, verbatim, unmodifiable), `UNTRUSTED_CONTENT_INSTRUCTION` (docs/07 §Prompt injection defense), `TASK_BEHAVIOR_DEFAULTS` (the four taskBehaviorInstructions strings).
- `packages/personas/src/compiler/compile-persona.ts` — `compilePersona(record, productContext?)` produces a `PersonaUXProfile`. Each uxBehavior facet is rendered from a small, deterministic decision tree over the record's `derivedTraits` bands (low/medium/high/unknown). No LLM call here — the compiler is a pure function so tests can assert specific output.
- The compiler enforces three AGENTS.md / docs/03 invariants at write time: provenance preserved (`sourceProvenance ← record.source`), no demographic claim invented (occupation/age/region only mentioned when present), no representativeness phrasing ("typical user", "average user", "all users", etc. blocked by tests).
- 8 vitest assertions: round-trip via PersonaUXProfileSchema, provenance preserved, REQUIRED_SYSTEM_INSTRUCTION verbatim in promptBlock, no occupation invention on sparse rows, no representativeness phrasing, productContext rendering, trait-conditional facets, locale-agnostic on a US/EN record.

**Gates**

- pnpm typecheck: pass (11 packages)
- pnpm lint: pass (94 files, 3 cosmetic auto-fixes)
- pnpm test: pass (core 57/57 + personas 26/26 = 83/83)

**Phase 2 status**

- TASK-010 ✓ TASK-011 ✓ TASK-012 ✓
- Remaining: TASK-013 (LocalParquetNemotronSource) is the load-bearing one for the demo path. TASK-014 (BYO JSON) and TASK-015 (HF fallback) can defer to stretch S6.

**Next iteration**

- TASK-013: LocalParquetNemotronSource — DuckDB-backed PersonaSource over the 9 Korea shards.

---

## Iteration 8 — 2026-05-01 14:04 KST — TASK-011 NemotronNormalizer (locale-agnostic)

**Pattern:** A (was scoped as B; downgraded once the parquet schema was already mapped in iteration 7's probe)

**Sub-agents consulted (1)**

- `dataset-validator` ran a small DuckDB query against the real Korea parquet shard 0, picked 5 rows at age=19 + 3 rows at age∈{40,45,50,55,60,65}, ran them through `normalizeNemotronRow`. **8/8 rows passed `PersonaRecordSchema`**. Provenance verified (`source.provider==='nvidia'`, `dataset`, `rowId` matches `uuid` exactly, license carried). `military_status` and `bachelors_field` from real rows landed in `narratives.raw`. No surprise columns — the parquet has 25 data columns, 23 land first-class, 2 in raw, FIRST_CLASS_MAP accounts for everything. No normalization bugs.

**What happened**

- `packages/personas/src/normalizers/nemotron.ts` — `normalizeNemotronRow(row, ctx)` with `FIRST_CLASS_MAP` table mapping every documented Nemotron column → camelCase PersonaRecord path; everything else flows into `narratives.raw`. BIGINT age coerced via `Number()`. List columns (skills/hobbies) JSON-parsed, comma-split fallback, empty drops.
- `packages/personas/src/normalizers/embedding-text.ts` — UX-focused template per docs/03 §Embedding text builder.

**Gates**

- core 57/57 + personas 18/18 = 75/75 green; typecheck/lint clean.

---

## Iteration 7 — 2026-05-01 14:01 KST — TASK-010 PersonaSource interface + MockPersonaSource

**Pattern:** A

**What happened**

- `packages/personas/src/sources/persona-source.ts` — `PersonaSource` interface + `PersonaSamplingConfig` + `PersonaSearchResult` types.
- `packages/personas/src/sources/mock-source.ts` — `MockPersonaSource` shipping 5 fixture personas: 19yo design student (Seoul), 55yo café owner (Suwon), 42yo SWE dad (Mapo), 67yo retired teacher (Busan), 31yo freelance designer (Seongdong). Every fixture has `source.provider="mock"` and `mock_*` id (AGENTS.md provenance rule). Fixtures span age 19-67, 4 provinces, 5 occupations — gives downstream tests variety.
- `matchesQuery()` covers age range, sex, country, province, and textQuery substring (case-insensitive, any-word match across persona narrative + occupation).
- 9 vitest assertions: ≥5 fixtures all valid PersonaRecord, mock-provider rule, demographic diversity, age range filter, textQuery filter (Korean and English), province filter, sample size, getById hit/miss.

**Probe result (run once, then deleted)**

- DuckDB on `data/personas/nemotron-korea/data/train-00000-of-00009.parquet` confirms 26 columns: `uuid`, 7 narrative `*_persona`, 5 narrative scalars, 2 list columns (skills/hobbies — `VARCHAR`, JSON-encoded), `cultural_background`, `career_goals_and_ambitions`, demographics (sex, age BIGINT, marital_status, family_type, housing_type, education_level, occupation), locale (country, province, district), plus Korea-specific `military_status` + `bachelors_field`. The normalizer (TASK-011 next) maps these column names → camelCase fields, JSON-parses the list columns, converts `BIGINT age` to JS number, and routes the two Korea-specific columns into `narratives.raw`.

**Gates**

- pnpm typecheck: pass (11 packages)
- pnpm lint:check: pass (88 files, zero violations)
- pnpm test: pass (core 57/57 + personas 9/9 = 66/66)

**Next iteration**

- TASK-011: NemotronNormalizer over the Korea schema.

---

## Iteration 6 — 2026-05-01 13:57 KST — TASK-006 Phase 1 boundary (Pattern C)

**Pattern:** C (phase-tester + spec-reviewer in parallel)

**Sub-agents consulted (2 of 4 budget)**

- `phase-tester` returned `ready=no`. Two blockers: a flaky id-collision test (3-byte suffix → 0.3% birthday-paradox collision per generator at 10k draws) and a lint-formatter violation in two `.ralph/tasks/*.json` files (depends arrays multi-line vs single-line).
- `spec-reviewer` returned `ready=yes` from the spec perspective. Every TASK-001..005 acceptance criterion mapped to specific `file:line` cites; AGENTS.md "Done criteria for a UX finding" 11-field checklist all met; docs/06's 11 required schemas all present. Suggested adding `newArtifactId` / `newInterviewId` (already shipped) to TASK-005's acceptance — applied.

**Fixes applied in this iteration (main thread)**

- `packages/core/src/ids.ts`: bumped `randomBytes(3)` → `randomBytes(6)` on all five non-finding generators. Random suffix is now 48 bits → ~1.4×10⁷ samples for a 1-in-a-million collision; the 10k stress test is no longer flaky. 57/57 still green.
- `pnpm lint --write` (which is `biome check --write .`) auto-collapsed the depends arrays. `pnpm lint:check` (no --write) now passes.
- `.ralph/tasks/TASK-005.json` acceptance updated to list the 6 generators and 5 time helpers actually shipped.

**Phase 1 closed**

- All TASK-001..TASK-005 marked completed; TASK-006 (this boundary) marked completed.
- 57 vitest assertions, 11 of 11 docs/06 schemas, all 11 friction types stable, locale-agnostic narratives.raw, 11-field UX finding contract enforceable at parse time.

**Gates after fixes**

- pnpm typecheck: pass (11 packages)
- pnpm lint:check: pass (78 files, zero violations)
- pnpm test: pass (core 57/57)

**Next iteration**

- TASK-010 (Phase 2 first task): NemotronNormalizer for the Korea shard, with locale-agnostic raw catch-all. Then DuckDB-backed `LocalParquetNemotronSource`, `MockPersonaSource`, `LocalJsonPersonaSource`, `PersonaCompiler`.

---

## Iteration 5 — 2026-05-01 13:55 KST — TASK-005 ID generators + ISO-8601 time helpers

**Pattern:** A

**What happened**

- `packages/core/src/ids.ts` — `newRunId / newEventId / newSignalId / newArtifactId / newInterviewId`, all built from `Date.now()` base36 (sortable 9-char prefix) + `randomBytes(3)`. `newFindingId(index?)` returns `F-001`-style padded ids when given a 0-based index, random `F-<8hex>` otherwise. Persona IDs are not generated here (externally formatted per the boot prompt).
- `packages/core/src/time.ts` — `nowIsoUtc / parseIsoUtc / isoToEpochMs / epochMsToIso / normalizeIsoToUtc`. ISO-8601 regex enforces explicit timezone (Z or ±HH:MM), so a naïve `2026-05-01T13:30:00` is rejected.
- 11 new tests + 46 existing → **57/57 green**. Coverage: 10k unique ids per generator under load, sequential F-001 progression up to F-1000, random F-* never collides with sequential, negative/non-integer index rejection, time-sortable across ms boundaries, ISO with Z and offset, KST↔UTC conversion preserving the session window endpoints, ms precision roundtrip, NaN/Infinity rejection.

**Gates**

- pnpm typecheck: pass (11 packages)
- pnpm lint: pass (78 files, 5 cosmetic auto-fixes)
- pnpm test: pass (core 57/57)

**Phase 1 status**

- TASK-001 ✓ TASK-002 ✓ TASK-003 ✓ TASK-004 ✓ TASK-005 ✓
- Next iteration: TASK-006 (Phase 1 boundary — Pattern C with phase-tester + spec-reviewer).

---

## Iteration 4 — 2026-05-01 13:53 KST — TASK-004 FrictionSignal + UXFinding + Interview schemas

**Pattern:** A

**What happened**

- `packages/core/src/schemas/friction-signal.ts` — `FrictionSignalTypeSchema` enum covers all 11 types from docs/04 (long_hesitation, repeated_click, dead_click, backtrack, form_error, scroll_search, task_abandonment, cta_not_found, copy_confusion, price_uncertainty, trust_uncertainty). Evidence requires ≥1 eventId.
- `packages/core/src/schemas/ux-finding.ts` — `UXFindingSchema` requires evidence.eventIds + frictionSignalIds (both ≥1), diagnosis.confidence ∈ [0, 1], recommendation.acceptanceCriteria ≥1, non-empty codingAgentPrompt. The shape directly matches docs/04 §Finding generation, so the analyzer's output is type-checked.
- `packages/core/src/schemas/interview.ts` — `InterviewSchema` enforces 3-5 Q&A pairs and requires every pair to cite ≥1 eventId so the interview generator cannot invent unsupported issues.
- 15 new tests + 31 existing → **46/46 green**. Coverage: all 11 friction types listed in stable order; valid signals; missing eventIds rejected; unknown type rejected; finding round-trip; out-of-range confidence rejected with descriptive path; missing eventIds/signalIds/criteria rejected; empty codingAgentPrompt rejected; 3-pair / 5-pair acceptance; <3 / >5 / ungrounded pair rejected.

**Gates**

- pnpm typecheck: pass (11 packages)
- pnpm lint: pass (74 files, 3 cosmetic auto-fixes)
- pnpm test: pass (core 46/46)

**Next iteration**

- TASK-005: ID generators + ISO-8601 timestamp helpers in `packages/core/src/{ids,time}.ts`.

---

## Iteration 3 — 2026-05-01 13:51 KST — TASK-003 RunConfig + RunEvent + Artifact schemas

**Pattern:** A

**What happened**

- `packages/core/src/schemas/run-config.ts` — `ViewportSchema`, `RunLimitsSchema`, `RunSafetySchema`, `RunArtifactsToggleSchema`, `RunConfigSchema` (with `personaQuery: PersonaSearchQuerySchema.optional()` per spec-changes), `RunStatusSchema`, `RunSchema`. `id` is optional on RunConfig (the CLI assigns it on hydrate).
- `packages/core/src/schemas/run-event.ts` — `BoundingBoxSchema`, `InteractiveElementSchema`, `ObservationSchema`, `RunEventResultSchema`, `RunEventSchema`. `action` is the cross-package `AgentActionSchema`.
- `packages/core/src/schemas/artifact.ts` — `ArtifactTypeSchema` (screenshot/trace/video/rrweb/report/compare/fix_prompt/interview), `ArtifactSchema` with relative `path`, `contentType`, `sizeBytes`, `metadata`.
- 11 new tests + 20 existing → **31/31 green**. The two example JSONs (`examples/run-config.checkout.json`, `examples/run-config.crack.json`) both validate.

**Spec-changes committed**

- docs/04 §Run config: `personaQuery: string` → `personaQuery: PersonaSearchQuery`. The string form was a typo — every actual usage is a structured query.
- examples/run-config.checkout.json: `targetUrl` port `3000` → `3100` to match the `examples/ecommerce-checkout` Next.js port.
- Both logged in `.ralph/spec-changes.md`.

**Gates**

- pnpm typecheck: pass (11 packages)
- pnpm lint: pass (70 files, 3 cosmetic auto-fixes)
- pnpm test: pass (core 31/31)

**Next iteration**

- TASK-004: FrictionSignal + UXFinding + Interview Zod schemas.

---

## Iteration 2 — 2026-05-01 13:48 KST — TASK-002 PersonaUXProfile + AgentAction schemas

**Pattern:** A

**What happened**

- `packages/core/src/schemas/persona-ux-profile.ts` — `PersonaUXBehaviorSchema` + `PersonaTaskBehaviorInstructionsSchema` + `PersonaUXProfileSchema`. The profile carries `sourceProvenance` (re-using `PersonaSourceSchema`), the four taskBehaviorInstruction strings, and the rendered `promptBlock` that the runtime DecisionProvider injects.
- `packages/core/src/schemas/agent-action.ts` — discriminated union on `type` with click/type/scroll/wait/back/stop variants. `reason` is required on every variant so the analyzer can ground each event.
- 8 new tests + the 12 existing → **20/20 green**. Coverage: every variant, unknown type rejection, missing reason rejection, unknown stop outcome rejection, negative wait duration rejection, click without selector but with x/y, UX profile round-trip, empty promptBlock rejection.

**Gates**

- pnpm typecheck: pass (11 packages)
- pnpm lint: pass (66 files, 4 cosmetic auto-fixes)
- pnpm test: pass (core 20/20)

**Next iteration**

- TASK-003: RunConfig + RunEvent + Artifact Zod schemas (must validate `examples/run-config.checkout.json` and `run-config.crack.json` end-to-end).

---

## Iteration 1 — 2026-05-01 13:46 KST — TASK-001 PersonaRecord + PersonaSearchQuery schemas

**Pattern:** A (single-package, clear spec)

**What happened**

- `packages/core/src/schemas/persona-record.ts` — `PersonaSourceSchema`, `PersonaLocaleSchema`, `PersonaDemographicsSchema`, `PersonaNarrativesSchema` (with `raw: z.record(z.unknown()).optional()` catch-all), `PersonaDerivedTraitsSchema`, `PersonaRecordSchema`. All inferred types exported.
- `packages/core/src/schemas/persona-search-query.ts` — `PersonaSearchQuerySchema` with `[number, number]` range tuples for UX traits, optional `diversityBy` enum array, `ageMin <= ageMax` refine on demographics.
- `packages/core/src/schemas/index.ts` barrel + re-exports from `packages/core/src/index.ts`.
- 12 vitest tests in `packages/core/src/__tests__/persona-record.test.ts`:
  - Korea-shaped fixture round-trip through JSON
  - provenance preservation
  - `narratives.raw` survives `military_status`, `bachelors_field`, and an unknown future column
  - minimum-surface acceptance (mock_*, custom:*)
  - invalid provider / negative age rejected with descriptive `path`
  - locale-agnostic synthetic English row routes unknown columns into raw
  - checkout demo's persona query verbatim
  - crack 19-19 narrow age window
  - empty query
  - unknown `diversityBy` enum rejected

**Gates**

- pnpm typecheck: pass (11 packages)
- pnpm lint: pass (63 files, 2 cosmetic auto-fixes applied)
- pnpm test: pass (`@personabench/core` 12/12 green; rest passWithNoTests)

**Next iteration**

- TASK-002: PersonaUXProfile + AgentAction Zod schemas.

---

## Iteration 0 — 2026-05-01 13:30 KST — TASK-000 Bootstrap

**Pattern:** A (main-thread, active)

**What happened**

- Read AGENTS.md, RALPH guide §4-5-7-12-15-17-22-24, docs/01..08, docs/12.
- Created root monorepo config: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `biome.json`, `vitest.config.ts`, `.npmrc`, expanded `.gitignore`.
- Scaffolded 9 packages: `core`, `personas`, `runner`, `recorder`, `analyzer`, `cli`, `mcp-server`, `integrations`, `ui`. Each has `package.json`, `tsconfig.json`, `src/index.ts` exporting a name constant.
- Scaffolded `apps/web` (Next.js 15 App Router, port 3000) — placeholder dashboard.
- Scaffolded `examples/ecommerce-checkout` (Next.js 15, port 3100) with the four documented intentional UX defects: hidden shipping fee, coupon/CTA visual competition, disabled CTA without inline reason, vague total ("약 ~원").
- Created `.ralph/{prd.json, status.json, progress.md, learnings.md, steering.md, spec-changes.md, stretch-queue.md, tasks/}`.
- Created `scripts/ralph/{preflight.sh, verify.sh, select-next-task.ts, update-task-status.ts}`.

**Gates after this iteration**

- G1/G2/G3/G4: not yet runnable — packages are placeholder shells.
- Phase-0 acceptance: install / build / typecheck / lint / test must all exit 0. Verified locally.

**Next iteration**

- TASK-001: PersonaRecord + narratives.raw schema (P1 first task).
