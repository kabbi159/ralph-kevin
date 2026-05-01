# PersonaBench Coding Agent Handoff

## One-line product

**PersonaBench** is an open-source UX testing system that runs **data-grounded persona agents** through a product, records where they hesitate or drop off, interviews them after the session, and converts every UX failure into an implementation-ready task for coding agents such as Claude Code or Codex.

## Tagline

> Don’t guess. Interview persona agents.

## Non-negotiable thesis

PersonaBench must not be “LLM, pretend to be a random user.”

The core moat is:

> Use **NVIDIA Nemotron-Personas** records as the grounding source for persona agents.

This means every persona used in a UX test must have provenance:

- source provider
- dataset id
- dataset revision if available
- row id / uuid if available
- locale / country
- metadata used for search or sampling
- license attribution text

Synthetic personas can be summarized, compiled, and transformed for UX testing, but they must be derived from a dataset record or an explicitly labeled custom enterprise record.

## Outcome (open-source product)

Build the complete open-source product. There is no MVP / post-MVP staging — the canonical scope is `docs/01_PRD.md`. The product can:

1. Load or sample personas from a Nemotron-Personas source (DuckDB on local parquet, plus HF streaming fallback).
2. Compile selected persona records into UX testing agents.
3. Run those agents against a URL using Playwright.
4. Record session artifacts (screenshots, trace, video, redacted DOM).
5. Detect UX friction signals (full set per `docs/04_RUNNER_ANALYZER_SPEC.md`).
6. Generate replay-backed UX findings with linked evidence.
7. Generate a coding-agent fix prompt.
8. Expose the system through:
   - CLI (`personabench run | report | findings | fix | rerun | compare | serve | mcp`)
   - local self-contained `report.html`
   - locally-served Next.js web app (dashboard, test builder, replay, compare, persona search/packs)
   - MCP server (`personabench mcp`)
   - issue/PR fan-out adapters (GitHub, Linear, Jira, copy/paste)

The hosted/enterprise commercialization track (multi-tenant SaaS, SSO, audit, hosted vector search, separate API/worker services) is documented in `docs/11_OPEN_SOURCE_AND_ENTERPRISE_SPLIT.md` and is **not** part of this build.

## Recommended implementation style

- Monorepo: `pnpm` workspace.
- Language: TypeScript-first.
- Browser automation: Playwright.
- Persona ingestion: DuckDB on local parquet (primary); Python helper for HF dataset streaming (fallback).
- Web app: Next.js (App Router) + Tailwind + shadcn/ui — pages and API routes in the same app, no separate API service.
- Storage: local filesystem only (`.personabench/runs/<runId>/`). No DB, no queue, no worker pool.
- Hosted product (separate track): would add Postgres + pgvector + a separate API server + worker pool — but that is out of scope for this build.

## Build sequence

Phases describe dependency order, not scope cuts. See `docs/08_IMPLEMENTATION_PLAN.md`.

1. Core schemas.
2. Persona source abstraction (DuckDB + HF + JSON + Mock adapters).
3. Persona compiler.
4. Playwright runner.
5. Event logger and recorder.
6. Friction detector.
7. Finding + interview + fix-prompt generators.
8. CLI.
9. Local HTML report.
10. Web app (dashboard / test builder / run progress / replay / compare / personas / packs).
11. MCP server.
12. Issue/PR integrations.

## Definition of done

A developer can run:

```bash
pnpm install
pnpm build

pnpm personabench run \
  --url http://localhost:3000/checkout \
  --task "Complete checkout up to the final payment confirmation. Do not make a real purchase." \
  --persona-source hf:nvidia/Nemotron-Personas-Korea \
  --persona-query "price-sensitive shopper who checks hidden fees" \
  --sample 3

pnpm personabench report --latest
pnpm personabench fix --finding F-001 --agent codex
```

And get:

```txt
.personabench/runs/<runId>/
  run.json
  personas.json
  events.ndjson
  findings.json
  interview.md
  fix-prompts/
    F-001.md
  artifacts/
    screenshots/
    trace.zip
    video.webm
  report.html
```

## Product caution

Never claim that PersonaBench replaces real user research.

Use this positioning:

> PersonaBench helps teams find obvious UX friction before real user research or production release.

Avoid:

> This represents actual user behavior.
> This replaces user interviews.
> This proves users will behave this way.

Use:

> data-grounded synthetic persona
> pre-research UX screening
> replay-backed UX finding
> persona-grounded hypothesis
