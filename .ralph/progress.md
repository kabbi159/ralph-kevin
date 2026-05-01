# Progress Log

Each iteration appends one block. Newest at the top.

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
