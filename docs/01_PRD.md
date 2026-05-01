# PRD: PersonaBench

## Objective

Build a local-first, open-source product that delivers the complete loop end-to-end:

> data-grounded persona selection → browser UX test → session replay/artifacts → friction detection → persona interview → UX finding → coding-agent fix prompt.

This document describes the **complete open-source product**. There is no MVP / post-MVP staging. Every feature listed below is in scope for this build. The hosted/enterprise commercialization track lives in a separate document — see `docs/11_OPEN_SOURCE_AND_ENTERPRISE_SPLIT.md`.

## Users

1. Developer running a local web app.
2. PM/designer viewing the generated report.
3. Coding agent receiving fix prompts.

## User stories

### Developer

As a developer, I want to run persona UX tests from the CLI so I can catch UX failures before merging a PR.

Acceptance:

- CLI accepts URL, task, persona source, persona query, sample size.
- CLI creates a run directory with machine-readable artifacts.
- CLI can generate an HTML report.
- CLI can generate a fix prompt for a finding.

### PM / Designer

As a PM/designer, I want to set up a test, watch it run, and inspect findings in a web app — without ever touching a terminal.

Acceptance:

- Web app accepts URL + task + persona search through a form.
- Web app shows live progress while the run executes.
- Web app shows replay video, event timeline, findings, and interview transcript on completion.
- Web app lets me compare two runs side-by-side (before/after).

### Coding agent

As a coding agent, I need clear, scoped implementation instructions so I can fix the observed UX issue.

Acceptance:

- Each finding has a `codingAgentPrompt`.
- Prompt includes evidence, target behavior, likely files/components if known, and acceptance criteria.
- Prompt asks for the smallest safe UX fix.
- An MCP server exposes the same capability so coding agents can call it directly without scraping output.

## Features

### 1. Persona source abstraction

```ts
interface PersonaSource {
  search(query: PersonaSearchQuery): Promise<PersonaSearchResult>;
  sample(config: PersonaSamplingConfig): Promise<PersonaRecord[]>;
  getById(id: string): Promise<PersonaRecord | null>;
}
```

Implementations:

- `MockPersonaSource` — for tests only.
- `LocalParquetNemotronSource` — reads downloaded parquet shards via DuckDB; supports the full `PersonaSearchQuery` (metadata filters + text substring + diversity sampling).
- `HuggingFaceNemotronSource` — streams from HF when local cache is unavailable.
- `LocalJsonPersonaSource` — for user-provided custom datasets ("bring your own").

### 2. Persona compiler

Transforms a `PersonaRecord` into a `PersonaUXProfile`.

Acceptance:

- Includes background.
- Includes UX behavior traits.
- Includes instruction to behave naturally and not optimize for task completion.
- Preserves provenance.

### 3. Browser runner

Use Playwright to run a persona through a URL.

Acceptance:

- supports desktop/mobile viewport
- supports max duration
- supports max actions
- logs observations and actions
- stores screenshots
- records trace/video if configured

### 4. Friction detector

Detection heuristics:

- long hesitation
- repeated click
- dead click
- backtrack
- form error
- scroll search
- task abandonment
- CTA not found

### 5. Finding generator

Converts run events + friction signals into findings.

Acceptance:

- links findings to evidence timestamps
- includes severity
- includes recommended fix
- includes coding-agent prompt
- includes confidence score

### 6. Interview generator

Generates a short post-session interview grounded in the behavior log.

Acceptance:

- must reference observed behavior
- must not invent unrelated user preferences
- must include 3-5 Q&A pairs
- must include summary

### 7. CLI

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

### 8. Local report (`report.html`)

Static, self-contained HTML file generated per run. Sections:

- run summary
- persona cards
- findings
- timeline
- interview
- links to artifacts
- fix prompts

The web app reuses the same React components for the equivalent server-rendered views.

### 9. Web app (Next.js, locally-served)

Launched via `personabench serve`. Single-process Next.js app reading/writing the same `.personabench/runs/<runId>/` artifacts the CLI uses. No external API server, no auth, no multi-tenancy — but a complete UI for the open-source single-user experience.

Pages:

#### `/` — Dashboard

- list of recent runs (file system enumerated, newest first)
- per-run summary card: URL, persona pack, status, top finding, timestamp
- "New test" CTA

#### `/runs/new` — Test Builder

Form fields:

- target URL
- task description + success criteria
- viewport (desktop/mobile)
- max duration / max actions
- safety toggles (block payment, domain allowlist)
- persona section:
  - locale dropdown (Korea selected; others enabled when their parquet is downloaded)
  - province multi-select, age range, sex, occupation
  - text query (narrative substring)
  - sample size + diversity-by checkboxes
  - "Search" → result cards → "Use these N personas"

Submit → POST `/api/runs` → spawns runner as child process → redirect to `/runs/:runId`.

#### `/runs/:runId` — Run progress + result

Polls `GET /api/runs/:runId` every 1-2s. Single page that flips between states from `status.json`:

- `pending` / `in_progress`: progress bar, current persona index, latest event line
- `completed`: replay viewer (left) + persona card / timeline / friction signals / findings / interview (right)
- `failed`: error reason + link to logs

#### `/runs/:runId/compare/:otherRunId` — Before/after compare

- resolved findings (in `otherRunId` but not in `runId`)
- new findings (in `runId` but not in `otherRunId`)
- hesitation time delta, task success rate delta, finding count delta

#### `/personas` — Persona browser

Persona search standalone (no run trigger). Save selections as named **persona packs** for reuse.

#### `/persona-packs` — Persona pack library

- list saved packs
- create new pack from a search
- export/import JSON

### 10. Run history

File-based — no database. The web app and CLI both enumerate `.personabench/runs/` and read each run's `run.json` summary. Filterable by URL, persona pack, status, date.

### 11. Persona packs

Reusable named bundles of `PersonaSearchQuery` + sampled `PersonaRecord[]`, persisted as JSON under `.personabench/persona-packs/`.

- create from a search
- save with name + description + coverage stats
- reuse pack as persona source for new runs
- export / import as standalone JSON

### 12. Before/after regression compare

Compare two runs (typically pre-fix vs post-fix):

- resolved findings
- new findings
- hesitation time delta
- task success rate delta
- finding count delta

CLI: `personabench compare <runIdA> <runIdB>` → static `compare.html`. Web: `/runs/:a/compare/:b`.

### 13. Issue/PR integrations

Send a fix prompt out to:

- GitHub PR comment (via `gh` CLI; no extra deps if user already has `gh` installed)
- Linear issue (via Linear API + token)
- Jira ticket (via Jira API + token)
- copy/paste fallback (always available, no auth required)

Tokens read from `.personabench/config.json` or environment variables. Each integration is a small adapter — adding more is a configuration concern, not a code rewrite.

### 14. MCP server

Exposes tools so coding agents can call PersonaBench directly:

- `run_persona_ux_test` — kick off a run from a URL + task
- `get_ux_findings` — fetch findings for a run
- `get_replay_link` — get a local file path or static URL for the replay
- `generate_fix_prompt` — render a fix prompt for a specific finding
- `rerun_ux_regression` — rerun the same config, return compare result

Launched via `personabench mcp`.

### 15. Custom persona datasets

`LocalJsonPersonaSource` accepts user-provided NDJSON or JSON arrays matching the `PersonaRecord` schema. Documentation includes a "bring your own dataset" section with the minimal required fields and an example.

## Demo target (presentation flow)

The presenter exercises both interfaces to show that the same engine drives both:

1. **CLI demo**: `personabench run --url <buggy checkout> --task "complete checkout" --persona-source nemotron-korea --query "price-sensitive 50대 여성" --sample 5` → opens `report.html` automatically.
2. **Web demo**: open `localhost:3000` → New Test form → Run → live progress → replay + findings + interview → click "Compare with previous run" → before/after delta.
3. **Business model**: separate slide track explaining the open-source vs hosted/enterprise split (see `docs/11_OPEN_SOURCE_AND_ENTERPRISE_SPLIT.md`).

## Hosted product (separate commercialization track — not built in this run)

These are documented in `docs/11_OPEN_SOURCE_AND_ENTERPRISE_SPLIT.md` and ship as a distinct hosted offering, not as part of this open-source build:

- multi-tenant SaaS with auth, projects, teams
- SSO / RBAC
- audit logs
- regional / VPC deployment
- self-hosted runner pool with autoscaling
- retention policies
- hosted vector persona search at production scale (pgvector / Qdrant fleet)
- separate billing API server
- hosted dashboard with trends and team-wide UX health metrics

## Non-goals (for the open-source product)

- real billing
- multi-tenant access control
- enterprise compliance certifications (SOC2 / ISO / etc.)
- replacement of real user research
- guarantee of demographic representativeness
- claim that synthetic personas are equivalent to actual users
