# PersonaBench

> Don't guess. Interview persona agents.

PersonaBench is an open-source UX testing system that drives **data-grounded persona agents** through a product, records where they hesitate or drop off, interviews them after the session, and turns every UX failure into an implementation-ready task for coding agents.

## Quickstart (clone-and-install)

This repo is the open-source product. There is no `npm publish` distribution; install from a clone.

```bash
git clone https://github.com/kabbi159/ralph-kevin.git personabench
cd personabench
pnpm install
pnpm -r build
pnpm personabench demo
```

`pnpm personabench demo` runs the scripted checkout demo end-to-end in well under two minutes (typically <1s on a warm cache):

- generates a friction-laden run against a Korean price-sensitive persona
- writes `report.html` with severity-ranked findings, evidence drawers, timeline, interview, and a coding-agent fix prompt per finding
- generates a post-fix run and a `compare-<runA>.html` showing every finding moved to **resolved**

```text
▶ personabench demo — scripted mode
  run A: run_xxx (10 signals, 7 findings)
▶ scripted post-fix run (G2 compare)
  run B: run_yyy (0 signals, 0 findings)
▶ compare → resolved=7 new=0
▶ report:  file:///.../.personabench/runs/run_xxx/report.html
▶ compare: file:///.../.personabench/runs/run_yyy/compare-run_xxx.html
```

Open `report.html` in a browser — it is fully self-contained (no external CDN, no JS frameworks).

## Concepts

PersonaBench treats every persona as a record from a real dataset, not a prompt-only fiction. Every emitted `PersonaRecord` carries `source.{provider, dataset, datasetRevision, rowId, license, attribution}`, and the report's footer always cites the source. Mock fixtures are explicitly named `mock_*` and never presented as data-grounded.

### Persona sources

- `MockPersonaSource` — five Korean fixtures spanning age 19-67, four provinces, five occupations. Used in unit tests and the scripted demo.
- `LocalParquetNemotronSource` — DuckDB-backed source over the downloaded `nvidia/Nemotron-Personas-*` parquet shards. Korea is the verified locale; other locales work via the same code path with no changes.
- `LocalJsonPersonaSource` — bring-your-own NDJSON / JSON-array of `PersonaRecord`-shaped rows. Validated row-by-row against the Zod schema.
- `HuggingFaceNemotronSource` — Python helper subprocess for HF-streamed datasets (deferred to stretch).

### Friction detection

Nine deterministic detectors run offline over the run event log:

- `long_hesitation` — wait ≥10 s OR inter-event gap ≥15 s
- `repeated_click` — 3+ same-selector clicks within 10 s
- `dead_click` — click with no URL/DOM change
- `backtrack` — back action or repeated navigation
- `scroll_search` — 3+ scrolls without an interactive action
- `cta_not_found` — task abandoned with no primary CTA click
- `price_uncertainty` — visible text mixes "약/approximate/~" with currency tokens
- `trust_uncertainty` — persona thoughtSummary mentions refund/cancel/policy
- `task_abandonment` — explicit `stop` with non-success outcome

Findings cluster signals by type, are severity-scored deterministically, and ship with a docs/04-shaped coding-agent fix prompt that an agent can paste into a PR.

## CLI

```text
personabench run --config <path> [--mode scripted|scripted-postfix|live]
personabench report --run <runId>
personabench compare <runIdA> <runIdB>
personabench demo
```

Run config files (validated against `RunConfigSchema`):

- `examples/run-config.checkout.json` — the local Next.js checkout demo on `localhost:3100`
- `examples/run-config.crack.json` — the live-site demo against `https://crack.wrtn.ai/` (live runner mode; deferred for the demo)

## Repository shape

```text
apps/web/                      Next.js dashboard (port 3000)
examples/ecommerce-checkout/   Demo target with intentional UX defects (port 3100)
packages/
  core/                        Zod schemas + types + ids + time helpers
  personas/                    PersonaSource adapters + Nemotron normalizer + compiler
  runner/                      agent-browser session driver + DecisionProvider + safety policy + run-persona-test loop
  recorder/                    (placeholder — full integration is stretch S10)
  analyzer/                    Friction detectors + finding aggregator + interview generator + fix-prompt renderer
  cli/                         personabench CLI
  mcp-server/                  (placeholder — stretch S5)
  integrations/                (placeholder — gh/Linear/Jira fan-out, deferred)
  ui/                          Shared React components (placeholder)
data/personas/nemotron-korea/  Local parquet cache (gitignored, ~2 GB)
.personabench/runs/            Run artifacts (gitignored)
```

## Security and safety

PersonaBench drives a real browser, so safety is non-negotiable:

- every run config declares an explicit domain allowlist; the runner halts on any cross-origin redirect
- `blockPaymentSubmission` (default true) intercepts any click on a button labeled `결제 확정` / `Place Order` / `submit-payment` / etc.
- `blockDestructiveActions` blocks `계정 삭제` / `delete account` / `deactivate` clicks
- `redactSensitiveFields` masks typed text on selectors named `password / cvv / otp / token / pin`, AND on credit-card / bearer-token patterns inside the typed value
- the persona prompt always carries the docs/03 §Required system instruction verbatim and a docs/07 §Prompt-injection defense block, so a hostile page cannot override the persona's behavior
- AGENTS.md prohibits real purchases, destructive actions, real production credentials, and presenting synthetic personas as a substitute for real user research

## Status

Phases shipped: P0 (bootstrap), P1 (core schemas), P2 (persona layer), P3 (runner), P5 (analyzer), P6 (CLI), P7 (report.html), demo gates G1-G3.

Deferred / stretch: live runner E2E (S1), persona packs (S4), MCP server end-to-end (S5), CI workflow (S7), full rrweb / video integration (S10), web app pages (P8). See `.ralph/spec-changes.md` and `.ralph/stretch-queue.md` for the running list.

## License & data attribution

PersonaBench is released as open source. Persona records emitted by `LocalParquetNemotronSource` carry the upstream NVIDIA Nemotron-Personas license (CC-BY-4.0); your reports must preserve `source.license` and the dataset attribution.
