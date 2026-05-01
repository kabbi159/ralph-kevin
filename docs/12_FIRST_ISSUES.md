# Suggested First GitHub Issues

## Issue 1: Bootstrap monorepo

Create pnpm workspace with initial packages and apps.

Acceptance:

- `pnpm install` works
- `pnpm build` works
- placeholder packages exist
- root AGENTS.md exists

Labels: `good first issue`, `infra`

## Issue 2: Add core schemas

Implement Zod schemas and TypeScript types.

Acceptance:

- schemas compile
- tests cover valid and invalid fixtures
- exported from `packages/core`

Labels: `core`

## Issue 3: Implement mock persona source

Implement `MockPersonaSource` for local tests.

Acceptance:

- returns fixture personas
- fixtures are clearly labeled mock
- no mock persona is presented as dataset-grounded

Labels: `personas`, `testing`

## Issue 4: Implement Nemotron normalizer

Map raw Nemotron-style rows into `PersonaRecord`.

Acceptance:

- preserves provenance
- maps locale/demographics/narratives
- builds embedding text
- handles missing fields

Labels: `personas`

## Issue 5: Implement persona compiler

Compile `PersonaRecord` into `PersonaUXProfile`.

Acceptance:

- includes behavior profile
- includes safety/task behavior instructions
- preserves source provenance
- avoids representativeness claims

Labels: `personas`, `agent`

## Issue 6: Implement Playwright runner skeleton

Acceptance:

- opens URL
- captures screenshot
- logs events
- stops after max duration/actions
- enforces allowed domains

Labels: `runner`

## Issue 7: Implement friction detector

Acceptance:

- long hesitation
- repeated click
- dead click
- backtrack
- task abandonment
- unit tests

Labels: `analyzer`

## Issue 8: Generate UX findings

Acceptance:

- findings link to event IDs
- severity assigned
- fix prompt generated
- JSON written to run directory

Labels: `analyzer`

## Issue 9: CLI run/report/fix

Acceptance:

- `personabench run`
- `personabench report`
- `personabench fix`
- local artifacts written

Labels: `cli`

## Issue 10: Example checkout app

Acceptance:

- intentionally flawed checkout page
- README with demo flow
- works locally

Labels: `example`, `demo`
