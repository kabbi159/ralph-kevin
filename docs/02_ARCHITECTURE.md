# PersonaBench Architecture

## High-level architecture

```txt
CLI / Web UI / MCP
        |
        v
API or Local Orchestrator
        |
        v
Test Orchestrator
        |
        +--> Persona Source
        +--> Persona Compiler
        +--> Browser Runner
        +--> Recorder
        +--> Event Logger
        +--> Friction Detector
        +--> Interview Generator
        +--> Finding Generator
        |
        v
Artifacts + Reports + Fix Prompts
```

## Local-first architecture

The product runs end-to-end on a single machine without any cloud service.

```txt
personabench run
  -> loads persona source
  -> samples personas
  -> starts Playwright
  -> records artifacts to local filesystem
  -> analyzes run
  -> writes report.html
```

## Hosted product architecture

```txt
Next.js Web
  -> API Server
  -> Queue
  -> Worker Pool
  -> Browser Runner
  -> Object Storage
  -> Postgres
  -> Vector Index
  -> Report Service
  -> Integrations
```

## Package responsibilities

### `packages/core`

Shared schemas and domain models:

- `RunConfig`
- `PersonaRecord`
- `PersonaUXProfile`
- `AgentAction`
- `RunEvent`
- `FrictionSignal`
- `UXFinding`
- `Interview`

### `packages/personas`

Everything related to persona data:

- source adapters
- Nemotron normalizer
- persona search
- metadata filtering
- diversity sampling
- UX trait derivation
- persona compiler

### `packages/runner`

Browser execution:

- Playwright lifecycle
- observe/decide/act loop
- viewport/auth config
- timeout/action limits
- safe action policies

### `packages/recorder`

Artifacts:

- screenshots
- Playwright trace
- video
- optional rrweb support
- redaction

### `packages/analyzer`

Run analysis:

- friction detection
- severity scoring
- evidence linking
- interview generation
- finding generation

### `packages/cli`

Developer interface.

### `packages/mcp-server`

Coding-agent integration.

Tools:

- `run_persona_ux_test`
- `get_ux_findings`
- `get_replay_link`
- `generate_fix_prompt`
- `rerun_ux_regression`

### `apps/web`

Next.js App Router web app. Both UI pages and API routes live here. The runner is spawned as a child process from a `POST /api/runs` route; status is read from the file system.

The hosted product's separate API service and worker pool (`apps/api`, `apps/worker` in earlier drafts) are part of the hosted track only — see `docs/11_OPEN_SOURCE_AND_ENTERPRISE_SPLIT.md`.

### `packages/integrations`

Issue/PR fan-out adapters: GitHub PR comment, Linear, Jira, copy/paste fallback.

### `packages/ui`

Shared React components (`PersonaCard`, `FindingCard`, `ReplayViewer`, `FrictionTimeline`, etc.) used by both `report.html` SSR and the live web app.

## Recommended initial repository

```txt
personabench/
  AGENTS.md
  README.md
  package.json
  pnpm-workspace.yaml
  turbo.json
  .env.example

  apps/
    web/                  # Next.js: pages + API routes

  packages/
    core/
    personas/
    runner/
    recorder/
    analyzer/
    cli/
    mcp-server/
    integrations/
    ui/

  plugins/
    claude-code/
    codex-skill/

  examples/
    ecommerce-checkout/

  data/
    personas/             # local HF dataset cache (gitignored)

  docs/
```

## Data flow

### 1. Create run

Input:

```ts
RunConfig
```

Output:

```ts
Run
```

### 2. Select personas

Input:

```ts
PersonaSearchQuery
```

Output:

```ts
PersonaRecord[]
```

### 3. Compile agents

Input:

```ts
PersonaRecord
```

Output:

```ts
PersonaUXProfile
```

### 4. Run browser test

Input:

```ts
RunConfig + PersonaUXProfile
```

Output:

```ts
RunEvent[] + artifacts
```

### 5. Analyze

Input:

```ts
RunEvent[]
```

Output:

```ts
FrictionSignal[]
```

### 6. Generate insights

Input:

```ts
RunEvent[] + FrictionSignal[] + PersonaUXProfile
```

Output:

```ts
Interview + UXFinding[]
```

## Storage layout

```txt
.personabench/
  config.json
  personas/
    cache/
  runs/
    <runId>/
      run.json
      personas.json
      events.ndjson
      friction-signals.json
      findings.json
      interview.md
      fix-prompts/
      artifacts/
        screenshots/
        trace.zip
        video.webm
      report.html
```

## Hosted DB sketch

Tables:

- `projects`
- `runs`
- `run_personas`
- `run_events`
- `friction_signals`
- `ux_findings`
- `interviews`
- `persona_sources`
- `persona_records`
- `persona_packs`
- `artifacts`
- `users`
- `teams`

## API boundary

Keep the domain logic in packages. Apps should orchestrate only.

Bad:

```txt
apps/web/components/FindingCard.tsx generates severity
```

Good:

```txt
packages/analyzer computes severity
apps/web renders severity
```
