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

## Build-time discoveries (2026-05-01 session)

### Dependency pinning gotchas

- `@duckdb/node-api` does not have a stable `^1.5.2`; the latest is `1.5.2-r.1` (prerelease). Use that exact pin.
- `@anthropic-ai/sdk` has no stable 1.x; `^0.92.0` is current.
- pnpm 10's "ignored build scripts" warning for `@biomejs/biome` / `agent-browser` / `esbuild` / `sharp` is harmless for our gates — biome's CLI is shipped as a postinstall-resolved binary that pnpm 10 still links into `node_modules/.bin/`. Don't run `pnpm approve-builds` blindly.

### Biome v1.9.4 quirks

- `useTemplate` is "unsafe-fix" so `--write` won't auto-apply. Manually convert `... + "\n"` → `\`${...}\\n\``.
- `noShadowRestrictedNames` flags any local `escape =` / `eval =` etc. Shadow with a different name (`escapeHtml`, `escapeFor*`).
- `delete process.env.X` is flagged as `useThrowOnlyError` ... actually as a different rule that wants `X = undefined`. **Do not** apply biome's auto-fix here — `process.env.X = undefined` becomes the string `"undefined"` (truthy), which breaks tests that check `if (!apiKey)`. Use `process.env.X = ""` instead — empty string is falsy.

### TypeScript with `noUncheckedIndexedAccess: true`

- Closures: `let x: T | null = null;` then assigning inside an async closure → CFA narrows `x` to `never` at the outer await point. Use a length-1 array (`const captured: T[] = []; ... captured.push(...)`) instead.
- Discriminated unions: `e.action?.selector` doesn't narrow because `selector` only exists on click/type variants. Pattern: `const action = e.action; if (!action || action.type !== "click") return; const sel = action.selector;`.
- Unreachable code after exhaustive switches: biome flags the `default:` exhaustiveness pattern (`const _exhaustive: never = action`). Drop the default if the switch covers every variant.

### DuckDB Node API

- `prep.bindBigInt(idx, v)` for BIGINT, `bindInteger` for int, `bindVarchar` for string. Indices are 1-based.
- BIGINT columns return JS `bigint` — `JSON.stringify` on a bigint throws. Sanitize with `Number(v)` shallow before passing to schemas.
- `read_parquet('<glob>')` enumerates a shard set in one logical relation. Single-quote the path; biome won't yell at glob characters.

### Korea Nemotron-Personas-Korea schema

- 26 columns: `uuid`, 7 `*_persona`, `cultural_background`, `skills_and_expertise`, `skills_and_expertise_list` (VARCHAR JSON-array), `hobbies_and_interests`, `hobbies_and_interests_list` (VARCHAR JSON-array), `career_goals_and_ambitions`, demographics (`sex`, `age` BIGINT, `marital_status`, `family_type`, `housing_type`, `education_level`, `bachelors_field`, `occupation`), locale (`country`, `province`, `district`), Korea-specific (`military_status`, `bachelors_field`).
- 23 first-class columns map directly onto `PersonaRecord`; `military_status` and `bachelors_field` flow into `narratives.raw` via the locale-agnostic catch-all.
- Age distribution starts at 19 — there are no rows aged 17 or 18. "10대 후반" therefore maps to `ageMin: 19, ageMax: 19`.

### Loop hygiene observations

- **The `update-task-status.ts` script writes pretty-printed multi-line JSON.** Biome's auto-collapse fights with that on each commit. Solution: run `pnpm lint` (which is `biome check --write`) before staging — it idempotently re-collapses single-element arrays.
- **`pnpm <script>` from a sub-package directory** delegates to the sub-package's `package.json`. If the script doesn't exist there (e.g., `lint`), pnpm errors with `Command "lint" not found`. Always `cd /Users/kevin/ralph-kevin && pnpm <script>` from root, or use `pnpm -r --if-present <script>`.
- **Bundling adjacent tasks into one iteration** (TASK-020+021, TASK-040+041+042, TASK-050..072) keeps pace when sub-agent budget would otherwise spike commit overhead. The `Ralph-Task: TASK-NNN,TASK-MMM` comma-list trailer is a clean way to record the bundle.
