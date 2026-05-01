# Learnings

Pinned facts the loop discovered or had handed to it. Append-only — never delete; revise in place if a fact becomes wrong.

---

## Pre-decided (handed to the loop in the boot prompt — accept verbatim)

- **Browser substrate**: `agent-browser@>=0.26.0` driven via subprocess only. `agent-browser chat` is forbidden (Vercel AI Gateway dependency + fixed system prompt blocks persona injection). Chrome binary is already at `~/.agent-browser/browsers/chrome-148.0.7778.97`; do not re-run `pnpm exec agent-browser install`.
- **DecisionProvider**: own implementation, Anthropic SDK direct. `claude-haiku-4-5-20251001` for runtime decisions, `claude-sonnet-4-6` for finding / interview / fix-prompt. Key: `process.env.ANTHROPIC_API_KEY` from `.env`. No Vercel AI Gateway path.
- **DuckDB**: `@duckdb/node-api@^1.5.2`. Legacy `duckdb` package fails on pnpm 10 native build.
- **Dataset shape**: `data/personas/nemotron-korea/data/train-*.parquet` — 9 shards, 1,000,008 rows × 26 columns. **Age 17 and 18 do not exist** — the youngest row is 19. So "10대 후반" maps to `ageMin: 19, ageMax: 19`. ≥3,050 rows match `19세 + 판타지 ∪ 웹툰 ∪ 소설` keywords.
- **Workspace**: `pnpm -r`. Do not introduce turbo / nx / changesets.
- **Web app**: Next.js 15 App Router. Tailwind + plain components (no shadcn shell during this build).
- **Recorder**: `rrweb=false` default. `trace`/`video` are opt-in and **not** required for the demo path (defer full integration to stretch S10).
- **Ports**: web app 3000, `examples/ecommerce-checkout` 3100. `RunConfig.targetUrl` for the checkout demo aligns to 3100.
- **Run artifacts**: under `.personabench/runs/<runId>/` (gitignored).
- **Persona ID format**: `nemotron:<dataset>:<rowId-or-uuid>` / `mock_<n>` / `custom:<dataset>:<id>`.
- **`narratives.raw`**: catch-all for every column not first-class on `PersonaRecord` — including Korea-specific `military_status`, `bachelors_field`, etc. Tests must assert that unknown columns flow into `raw` rather than being dropped.
- **Integrations**: copy/paste fallback is mandatory; `gh` / Linear / Jira are graceful no-ops if tokens absent.
- **Ignored**: `.ralph/iteration-logs/`, `.personabench/`, `data/personas/`.

## Loop hygiene (from Ralph guide)

- **Commit + push must be separate Bash calls.** `git commit ... && git push` is rejected by the harness safety classifier even on the loop's own branch (`develop`). See guide §12 "Harness trap".
- **Sub-agent budget per phase boundary: 4 calls** (`phase-tester`, `spec-reviewer`, `safety-auditor`, `dataset-validator` combined). After 4, main thread takes over (guide §24.5b). Explore/Plan in Pattern B do not count.
- **Pattern C is mandatory at the boundary of P1, P2, P3, P5, P6** only. P0/P4/P7/P8/P9/P10/P11 boundaries can be main-thread when time-budget is `active`. (Per boot prompt — overrides any "every phase" rule from the guide.)
- **§12 trailers** must appear in every commit body: `Ralph-Task`, `Ralph-Iteration`, `Ralph-Agent`, `Ralph-Pattern`, optional `Ralph-Subagents`, `Status`, `Verification`. Blocked/failed adds `Reason` and `Next`.
