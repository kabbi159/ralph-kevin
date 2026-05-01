# Implementation Plan

Phases describe a **build sequence in dependency order**, not scope cuts. All phases deliver part of the complete open-source product described in `docs/01_PRD.md`. The Ralph time-budget hook (`RALPH_LOOP_AUTONOMOUS_BUILD_GUIDE.md` §17) handles graceful degradation if iteration budget runs short — at WARNING/CRITICAL the loop stops adding new work and focuses on integration, verification, and commit of what already exists.

Every phase ends with a **Pattern C (phase-boundary) iteration** as defined in §24 of the Ralph guide:

- the `phase-tester` sub-agent runs the phase's declared test commands and returns a structured report
- the `spec-reviewer` sub-agent audits acceptance criteria
- domain-specific sub-agents (`safety-auditor`, `dataset-validator`) run when the phase touches their territory
- the main thread does not commit the phase-complete tag until `phase-tester` reports `ready: yes`

Each phase below lists `Tests` (verification gates the `phase-tester` must run) and `Sub-agents at boundary` (which custom agents run during Pattern C).

---

## Phase 0: Bootstrap

Tasks:

- create pnpm monorepo
- add TypeScript config
- add lint/test/build scripts
- create package folders
- add root `AGENTS.md`
- add example app skeleton

Tests:

- `pnpm install` succeeds on clean clone
- `pnpm build` exits 0 with placeholder packages
- `pnpm test` runs (zero tests is acceptable; the runner must be wired)
- `pnpm lint` and `pnpm typecheck` exit 0
- repo shape matches `AGENTS.md` "Repository shape"
- `examples/ecommerce-checkout` boots locally (`pnpm --filter ecommerce-checkout dev`)

Sub-agents at boundary: `phase-tester`, `spec-reviewer`.

---

## Phase 1: Core schemas

Create:

```txt
packages/core/src/
  schemas/
  types/
  ids.ts
  time.ts
```

Implement (Zod schemas + inferred types):

- `RunConfig`
- `PersonaRecord`
- `PersonaSearchQuery`
- `PersonaUXProfile`
- `AgentAction`
- `RunEvent`
- `FrictionSignal`
- `UXFinding`
- `Interview`
- `Artifact`

Tests:

- valid fixture round-trips through schema (parse → JSON → parse → deep-equal)
- invalid fixture rejected with descriptive Zod error
- `PersonaRecord.narratives.raw` accepts arbitrary unknown columns (locale-agnostic)
- `id` generators are stable and collision-resistant
- timestamps are ISO-8601 with timezone

Sub-agents at boundary: `phase-tester`, `spec-reviewer`.

---

## Phase 2: Persona layer

Create:

```txt
packages/personas/src/
  sources/
  normalizers/
  compiler/
  sampling/
```

Implement:

- `PersonaSource` interface
- `MockPersonaSource`
- `LocalJsonPersonaSource`
- `LocalParquetNemotronSource` (DuckDB-backed)
- `HuggingFaceNemotronSource`
- `NemotronNormalizer`
- `PersonaCompiler`

Python helper for HF sampling (used as a fallback when local parquet cache is missing).

Tests (Korea-only verification per `docs/03_PERSONA_DATA_LAYER.md`):

- normalizer maps raw Korea rows to `PersonaRecord` with provenance preserved
- normalizer is locale-agnostic: a synthetic row with unknown columns flows them into `narratives.raw`
- compiler outputs a `PersonaUXProfile` with the required prompt block
- compiler does not invent demographic claims absent from the input row
- DuckDB query supports each documented `PersonaSearchQuery` filter (locale, demographics, text substring)
- diversity sampling distributes across age × region × occupation across a fixture of ≥100 rows
- `LocalJsonPersonaSource` accepts a custom NDJSON fixture and exposes the same interface
- fixtures live under `packages/personas/fixtures/nemotron-korea/`

Sub-agents at boundary: `phase-tester`, `spec-reviewer`, `dataset-validator`.

---

## Phase 3: Runner

Create:

```txt
packages/runner/src/
  runPersonaTest.ts
  browser/
  observe/
  decide/
  act/
  safety/
```

Implement:

- Playwright browser lifecycle (launch → navigate → close)
- page observation (DOM snapshot + accessibility tree + screenshot)
- action execution (click, type, scroll, wait)
- event logging (each observation/action/decision emits a `RunEvent`)
- `maxDurationSec` and `maxActions` enforcement
- `domain allowlist` enforcement
- safety policies (block payment submission, redact sensitive selectors)

`decide` uses a `DecisionProvider` interface. Ship two implementations:

- `MockDecisionProvider` for tests (deterministic action plans)
- `ClaudeDecisionProvider` for real runs (Anthropic SDK)

```ts
interface DecisionProvider {
  decide(input: DecisionInput): Promise<AgentAction>;
}
```

Tests:

- launch + close lifecycle produces no leaked browser process
- action execution against `examples/ecommerce-checkout` performs each action type
- `maxDurationSec`: run terminates at deadline with `stopReason: timeout`
- `maxActions`: run terminates after the cap with `stopReason: action_limit`
- domain allowlist: navigation outside the allowlist halts run with `safety_violation` event
- payment-submit attempt is blocked and logged as `payment_blocked`
- screenshot saved per observation step
- event log roundtrips through `RunEventSchema`
- `MockDecisionProvider` runs the deterministic plan end-to-end against a fixture HTML page

Sub-agents at boundary: `phase-tester`, `spec-reviewer`, `safety-auditor`.

---

## Phase 4: Recorder

Create:

```txt
packages/recorder/src/
  screenshots.ts
  video.ts
  trace.ts
  redaction.ts
```

Implement:

- artifact paths per `docs/02_ARCHITECTURE.md` storage layout
- Playwright trace/video options
- screenshot saving
- redaction hooks for sensitive DOM fields

Tests:

- `trace.zip` is created and openable by Playwright Trace Viewer for a sample run
- `video.webm` is created when the run config requests it
- screenshots saved at `.personabench/runs/<runId>/artifacts/screenshots/<step>.png`
- redaction hooks fire on configured selectors (`input[type=password]`, CC/CVV patterns, configurable selectors) — masked tokens in event log
- redacted fields are also masked in screenshots/video where Playwright supports it
- a deliberately-leaky fixture run produces a redacted artifact set with no plaintext secrets in any output file (grep test)

Sub-agents at boundary: `phase-tester`, `spec-reviewer`, `safety-auditor`.

---

## Phase 5: Analyzer

Create:

```txt
packages/analyzer/src/
  friction/
  findings/
  interview/
  fixPrompt/
```

Implement:

- friction heuristics (full set per `docs/04_RUNNER_ANALYZER_SPEC.md`)
- severity scoring
- evidence linking
- interview generator
- fix prompt generator

Tests:

- each friction heuristic detects its target pattern in a deterministic fixture event log:
  - long_hesitation, repeated_click, dead_click, backtrack, form_error, scroll_search, task_abandonment, CTA_not_found, price_uncertainty, trust_uncertainty
- severity scoring is deterministic and matches a fixture
- finding references correct `eventIds` and `screenshotPaths`
- fix prompt contains: evidence, target behavior, likely files, acceptance criteria
- interview generator produces 3-5 Q&A pairs grounded in the event log; does not invent unrelated user preferences
- fix prompt regression: same input produces same output (snapshot test)

Sub-agents at boundary: `phase-tester`, `spec-reviewer`.

---

## Phase 6: CLI

Create:

```txt
packages/cli/src/
  commands/
    init.ts
    personas.ts
    run.ts
    report.ts
    findings.ts
    fix.ts
    rerun.ts
    compare.ts
    serve.ts
    mcp.ts
```

Commands:

```bash
personabench init
personabench personas search
personabench run
personabench report
personabench findings
personabench fix
personabench rerun
personabench compare
personabench serve            # launches the web app
personabench mcp              # launches the MCP server
```

Tests:

- argument parsing for every command (snapshot tests on `--help`)
- `personabench init` creates `.personabench/config.json` with sane defaults
- `personabench run --url ... --task ...` creates `.personabench/runs/<runId>/` with the documented file set
- `personabench report --latest` exits 0 and writes `report.html`
- `personabench findings` returns a non-empty list for a fixture run
- `personabench fix --finding F-001` produces a valid prompt (passes Zod parse)
- `personabench compare A B` writes `compare.html` and exits 0
- non-zero exit codes on failure paths (missing run, invalid URL, allowlist violation in config)
- redaction behavior preserved at CLI layer (no plaintext secret in stdout/stderr)

Sub-agents at boundary: `phase-tester`, `spec-reviewer`.

---

## Phase 7: Local report (`report.html`)

Static, self-contained file generated per run. Sections:

- run summary
- persona cards
- timeline
- findings
- interview
- artifact links
- fix prompts

Use the same React components later mounted in the web app — `report.html` is server-rendered and bundled to a single HTML file.

Tests:

- `report.html` is generated for a fixture run with all sections present
- HTML is self-contained: no external script/style URLs (allowlist of permitted CDN entries documented if any)
- relative paths resolve to local artifact files (`./artifacts/screenshots/...`, `./video.webm`, `./trace.zip`)
- snapshot test: bytes-stable diff for the same fixture input across runs
- accessibility smoke (axe or pa11y on the rendered file): no critical violations
- no PII or secret leakage in the rendered HTML (grep test on the fixture's known sensitive values)

Sub-agents at boundary: `phase-tester`, `spec-reviewer`.

---

## Phase 8: Web app

Create `apps/web` (Next.js, App Router). Pages:

- `/` — dashboard (file-system-enumerated runs list, "New test" CTA)
- `/runs/new` — Test Builder form (URL + task + persona search via DuckDB)
- `/runs/:runId` — progress polling → replay + findings + interview view
- `/runs/:runId/compare/:otherRunId` — before/after compare
- `/personas` — persona search browser
- `/persona-packs` — pack library

API routes (Next.js, no separate server):

- `POST /api/runs` — spawn runner as child process; return runId
- `GET /api/runs` — enumerate `.personabench/runs/`
- `GET /api/runs/:runId` — read `status.json` + summary
- `GET /api/runs/:runId/events` / `findings` / `interview`
- `POST /api/personas/search` — DuckDB query
- `POST /api/persona-packs` — save a pack
- `POST /api/findings/:findingId/fix-prompt` — render prompt
- `POST /api/runs/:runId/rerun` — duplicate config, kick off new run

State is on disk; the web app survives full reload mid-run.

Tests:

- each page renders server-side without errors (Next.js build-time check + smoke render)
- `POST /api/runs` creates a run dir and spawns the runner child process; child PID recorded in `status.json`
- `GET /api/runs/:runId` returns valid JSON parseable by `RunSchema`
- polling cycle: status transitions `pending → in_progress → completed`
- form submission e2e (Playwright against the dev server): URL+task+persona → run kicks off → result page shows replay + findings
- compare page renders the diff for two fixture runs
- web app survives a hard reload mid-run: state recovered from disk, polling resumes
- `POST /api/personas/search` returns rows shaped by `PersonaRecord`
- error paths: invalid URL → 400 with `INVALID_CONFIG`; missing runId → 404 with `RUN_NOT_FOUND`

Sub-agents at boundary: `phase-tester`, `spec-reviewer`.

---

## Phase 9: MCP server

Create `packages/mcp-server/src/` with tools:

- `run_persona_ux_test`
- `get_ux_findings`
- `get_replay_link`
- `generate_fix_prompt`
- `rerun_ux_regression`

Calls the same internal services the CLI and web app use; no HTTP roundtrip.

Tests:

- each tool's input schema matches `docs/06_API_SCHEMA.md` MCP tool contracts
- each tool's output passes its declared output schema
- `run_persona_ux_test` produces a runId and the run dir on disk
- `get_ux_findings` returns findings for an existing runId
- `generate_fix_prompt` returns non-empty prompt for a valid findingId
- error model: invalid input returns a structured error with a known code
- launches via `personabench mcp` and is reachable over stdio (MCP smoke handshake)

Sub-agents at boundary: `phase-tester`, `spec-reviewer`.

---

## Phase 10: Integrations

Issue/PR fan-out adapters:

- GitHub PR comment (via `gh` CLI; degrade gracefully if `gh` is missing)
- Linear issue (via Linear API + token)
- Jira ticket (via Jira API + token)
- copy/paste fallback

Tokens read from `.personabench/config.json` or environment variables. Each adapter is a small file behind a common interface.

Tests:

- GitHub adapter calls `gh pr comment` with the right args (subprocess mock)
- Linear adapter constructs the right GraphQL mutation (HTTP mock with `nock` or `msw`)
- Jira adapter constructs the right REST POST (HTTP mock)
- copy/paste fallback always returns the rendered prompt regardless of token state
- missing token → adapter returns a clear error (`INTEGRATION_MISSING_TOKEN`), never silently no-ops
- `gh` missing → GitHub adapter degrades to copy/paste with a warning, never throws
- prompt content is byte-identical across all adapters for the same finding

Sub-agents at boundary: `phase-tester`, `spec-reviewer`.

---

## Phase 11: Persona packs and run history polish

- `personabench packs` CRUD commands (`create`, `list`, `show`, `delete`, `export`, `import`)
- pack export/import JSON (`PersonaPackSchema`)
- web `/persona-packs` library
- run-history filter UI (URL, persona pack, status, date)

Tests:

- `personabench packs create` saves under `.personabench/persona-packs/<id>.json`
- `PersonaPack` roundtrips through `PersonaPackSchema` via export → import (deep-equal)
- web `/persona-packs` lists saved packs
- run-history filters by URL, status, date, persona pack — each returns the expected subset on a multi-run fixture
- pack reuse: starting a new run from a saved pack uses pack's `PersonaRecord[]` without re-querying the source

Sub-agents at boundary: `phase-tester`, `spec-reviewer`, `dataset-validator` (if pack creation touched DuckDB).

---

## Final integration phase

After Phase 11 completes, one final iteration:

1. Run all phase-tester reports back-to-back (Phases 0..11) to confirm no cross-phase regression
2. Run `safety-auditor` over the entire codebase, not just runner/recorder
3. Run a full demo flow end-to-end (CLI path + Web path) against `examples/ecommerce-checkout`
4. Generate a fresh `report.html` and a `compare.html` for two runs
5. Tag the final commit `release/personabench-v0.1`

This iteration is Pattern C with all four sub-agents (`phase-tester`, `spec-reviewer`, `safety-auditor`, `dataset-validator`) consulted in turn.

---

## Demo target

Create `examples/ecommerce-checkout` with intentional UX issues:

- shipping fee hidden until late
- coupon input competes with CTA
- disabled CTA without clear reason
- vague final total

Demo flow (presentation-ready, both interfaces):

**CLI path**

```bash
personabench run \
  --url http://localhost:3000/checkout \
  --task "complete checkout up to confirmation" \
  --persona-source nemotron-korea \
  --query "price-sensitive 50대 여성" \
  --sample 5
# auto-opens report.html
```

**Web path**

1. `personabench serve` → open `localhost:3000`
2. New Test → fill URL + task + persona filters → Run
3. Watch live progress → replay + findings + interview
4. Apply a UI fix in `examples/ecommerce-checkout`
5. Click "Rerun" → wait → click "Compare with previous run"
6. Show before/after delta: resolved findings, hesitation drop, success rate gain

**Business model talking points** (presenter slides — see `docs/11_OPEN_SOURCE_AND_ENTERPRISE_SPLIT.md`):

- Open-source product = the whole loop, runs locally
- Hosted product = multi-tenant SaaS, SSO, audit, scale
- Enterprise = self-hosted + VPC + retention + private runners
