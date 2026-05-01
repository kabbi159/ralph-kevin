# PersonaBench Ralph Loop Autonomous Build Guide

> 목적: PersonaBench를 **사람이 직접 코드를 만지지 않는 Ralph Loop 방식**으로 구현하기 위한 운영 문서.
>
> 운영 원칙: 사람은 **spec / priority / safety boundary**만 제공하고, 구현·검증·커밋·진행상태 업데이트는 에이전트 루프가 수행한다.

---

## 0. What is Ralph Mode?

Ralph Mode is a long-running autonomous development workflow.

Instead of:

```txt
Human asks agent -> watches -> edits -> asks again -> edits again
```

we use:

```txt
PRD + task queue + verification gates + git history + progress memory
    -> fresh coding agent iteration
    -> implement one task
    -> verify
    -> commit
    -> update progress
    -> repeat
```

For PersonaBench, Ralph Mode means:

```txt
Human writes:
- product intent
- task list
- acceptance criteria
- safety constraints
- verification commands

Agent does:
- implementation
- tests
- browser checks
- docs updates
- commits
- progress tracking
- reruns until completion or safe stop
```

---

## 1. Non-negotiable Rules

### 1.1 No human code edits

During Ralph Mode, humans must not directly edit code.

Allowed human actions:

- write or revise PRD before starting
- start/stop the loop
- adjust task priority through steering files
- inspect logs
- approve a final merge
- restart from a clean checkpoint

Not allowed:

- editing implementation files mid-loop
- manually fixing tests
- manually formatting code
- manually committing agent work
- silently changing requirements outside the tracked PRD/task files

### 1.2 Every iteration must leave evidence

Each loop iteration must produce:

- git diff
- test output
- lint/typecheck output
- status update
- task state update
- commit or explicit failure reason
- updated learnings if the agent discovered project conventions

### 1.3 Fresh context, persistent memory

Each iteration should start a fresh coding agent session.

Memory persists through files, not chat context:

```txt
git history
AGENTS.md
.ralph/prd.json
.ralph/tasks/*.json
.ralph/progress.md
.ralph/learnings.md
.ralph/iteration-logs/
```

### 1.4 One task per iteration

Each iteration should implement one small task.

Bad task:

```txt
Build the entire PersonaBench platform.
```

Good task:

```txt
Create Zod schema for PersonaRecord and add serialization tests.
```

### 1.5 Verification gates are mandatory

A task is not complete because the agent says it is complete.

A task is complete only when:

- acceptance criteria pass
- automated checks pass
- required artifacts exist
- task status is updated
- code is committed

---

## 2. Why Ralph Mode Fits PersonaBench

PersonaBench is a strong fit for Ralph Mode because it has natural verification gates:

```txt
Core schemas        -> unit tests
Persona layer       -> fixture normalization tests
Runner              -> Playwright smoke tests
Analyzer            -> deterministic event-log tests
CLI                 -> command snapshot tests
Web UI              -> browser smoke tests
MCP server          -> tool contract tests
Example app         -> end-to-end demo run
```

The product itself is also about agentic testing, so the implementation workflow should dogfood the product philosophy:

```txt
PersonaBench tests UX with persona agents.
Ralph Loop builds PersonaBench with coding agents.
```

---

## 3. Required Repository Files

Create these files before starting the loop.

```txt
AGENTS.md
README.md

.ralph/
  prd.json
  progress.md
  learnings.md
  steering.md
  loop-config.json
  status.json
  tasks/
    TASK-001.json
    TASK-002.json
    ...
  iteration-logs/
  artifacts/

scripts/
  ralph/
    ralph-once.sh
    ralph-loop.sh
    select-next-task.ts
    update-task-status.ts
    preflight.sh
    verify.sh
    commit-task.sh
```

---

## 4. PRD Format

Use `prd.json` as the source of truth.

```json
{
  "project": "PersonaBench",
  "branchName": "feature/personabench",
  "mode": "ralph-autonomous",
  "definitionOfDone": [
    "All tasks in the queue are complete or graceful-degraded by the time-budget hook",
    "pnpm build passes",
    "pnpm test passes",
    "pnpm lint passes",
    "Example checkout demo can run locally",
    "CLI can generate a local report from a sample run",
    "Web app launches via `personabench serve` and runs the demo flow end-to-end",
    "No secret or payment action is allowed in browser runner"
  ],
  "globalConstraints": [
    "Do not use prompt-only personas as production persona source",
    "Preserve Nemotron persona provenance",
    "Do not claim synthetic personas replace real user research",
    "Block real payment and destructive actions",
    "Keep packages local-first and cloud-optional"
  ],
  "qualityGates": {
    "install": "pnpm install",
    "build": "pnpm build",
    "test": "pnpm test",
    "lint": "pnpm lint",
    "typecheck": "pnpm typecheck"
  },
  "tasks": [
    {
      "id": "TASK-001",
      "title": "Bootstrap pnpm monorepo",
      "priority": 100,
      "status": "pending",
      "risk": "low",
      "acceptanceCriteria": [
        "pnpm-workspace.yaml exists",
        "packages/core exists",
        "packages/personas exists",
        "packages/cli exists",
        "pnpm build succeeds with placeholder packages"
      ],
      "verificationCommands": [
        "pnpm build"
      ]
    }
  ]
}
```

---

## 5. Task File Format

Each task should also exist as a separate file for easy retrieval.

`/.ralph/tasks/TASK-001.json`

```json
{
  "id": "TASK-001",
  "title": "Bootstrap pnpm monorepo",
  "priority": 100,
  "status": "pending",
  "risk": "low",
  "blockedReason": null,
  "dependsOn": [],
  "scope": {
    "allowedPaths": [
      "package.json",
      "pnpm-workspace.yaml",
      "turbo.json",
      "packages/**",
      "apps/**"
    ],
    "forbiddenPaths": [
      ".env",
      ".env.local",
      "node_modules/**"
    ]
  },
  "instructions": [
    "Create the initial monorepo skeleton.",
    "Use TypeScript package structure.",
    "Do not implement product logic yet."
  ],
  "acceptanceCriteria": [
    "pnpm install works",
    "pnpm build works",
    "placeholder package exports compile"
  ],
  "verificationCommands": [
    "pnpm build",
    "pnpm typecheck"
  ],
  "artifactsExpected": [
    "pnpm-workspace.yaml",
    "packages/core/package.json"
  ]
}
```

---

## 6. Task Sizing Rules

Ralph works best when tasks are small and independently verifiable.

### Good task size

A single task should be completable in one context window and one commit.

Examples:

```txt
- Add PersonaRecord Zod schema and tests
- Implement MockPersonaSource
- Add long_hesitation friction detector
- Create CLI command parser for `personabench run`
- Generate static HTML report from findings.json
```

### Too large

Split these:

```txt
- Build the entire web UI
- Implement all PersonaBench packages
- Add enterprise security
- Create hosted vector search
- Integrate every coding agent
```

### Suggested first PersonaBench Ralph tasks

```txt
TASK-001 Bootstrap monorepo
TASK-002 Add core schemas
TASK-003 Add mock persona fixtures
TASK-004 Add Nemotron normalizer
TASK-005 Add persona compiler
TASK-006 Add Playwright runner skeleton
TASK-007 Add event logger
TASK-008 Add friction detector
TASK-009 Add finding generator
TASK-010 Add fix prompt generator
TASK-011 Add CLI run command
TASK-012 Add CLI report command
TASK-013 Add example checkout app
TASK-014 Add browser smoke test
TASK-015 Add MCP server stub
TASK-016 Add web UI run viewer skeleton
```

---

## 7. Ralph Loop Algorithm

Each iteration should do this exact sequence.

```txt
1. Preflight
   - ensure clean or expected git state
   - read .ralph/prd.json
   - read .ralph/progress.md
   - read .ralph/learnings.md
   - read AGENTS.md
   - run lightweight sanity check

2. Select next task
   - choose highest-priority pending task
   - skip blocked tasks
   - prefer risky foundation tasks early
   - write selected task to .ralph/status.json

3. Spawn fresh coding agent
   - pass task file
   - pass AGENTS.md
   - pass relevant docs
   - pass verification commands
   - pass safety rules

4. Implement
   - modify only allowed paths
   - keep scope narrow
   - add tests where appropriate
   - update docs when behavior changes

5. Verify
   - run task-specific commands
   - run global checks when affordable
   - run browser check for UI tasks
   - capture logs

6. Decide
   - if verification passes:
       mark task complete
       update progress
       update learnings
       commit
   - if verification fails:
       attempt bounded self-repair
       if still failing, mark blocked with reason
       commit only if repository remains useful and checks are not worse

7. Repeat
   - stop when all tasks complete, budget exhausted, or safety stop triggered
```

---

## 8. Status Model

Each task can have one of:

```txt
pending
in_progress
completed
blocked
failed
skipped
```

State transition rules:

```txt
pending -> in_progress
in_progress -> completed
in_progress -> blocked
in_progress -> failed
blocked -> pending     // only through steering or human reset
failed -> pending      // only through steering or human reset
```

---

## 9. Stop Conditions

The loop must stop when any of these occur.

### Completion stop

```txt
All tasks in the queue are completed.
```

### Safety stop

```txt
Agent attempts to:
- access secrets
- use production credentials
- perform real payment
- delete data
- leave domain allowlist
- bypass safety rules
```

### Repeated failure stop

```txt
Same task fails 3 iterations in a row.
```

### Dirty state stop

```txt
Repository has uncommitted changes not owned by current iteration.
```

### Budget stop

```txt
Max iterations, time budget, or cost budget reached.
```

### Ambiguity stop

```txt
Task cannot be completed because requirements are contradictory.
```

In ambiguity cases, the agent should write a precise blocking note, not guess.

---

## 10. Human Steering Without Coding

Humans can steer through `.ralph/steering.md`.

Example:

```md
# Steering

## Priority override

Focus on CLI and local report before web UI.

## Current concern

Do not spend time on hosted vector search yet.

## Safety

Keep all runner actions local-only. No production URLs.
```

Rules:

- Steering can change priority.
- Steering can clarify requirements.
- Steering cannot silently redefine completed acceptance criteria.
- Steering should be committed before restarting the loop.

---

## 11. Verification Gates for PersonaBench

### Global verification

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

### Persona layer

```bash
pnpm --filter @personabench/personas test
```

Must verify:

- Nemotron row normalization
- provenance preservation
- missing fields handling
- persona compiler output
- mock personas clearly labeled

### Runner layer

```bash
pnpm --filter @personabench/runner test
```

Must verify:

- domain allowlist
- max actions
- max duration
- event logging
- action safety policy

### Analyzer layer

```bash
pnpm --filter @personabench/analyzer test
```

Must verify:

- long hesitation
- repeated click
- dead click
- backtrack
- form error
- task abandonment
- finding evidence linkage

### CLI

```bash
pnpm --filter @personabench/cli test
```

Must verify:

- argument parsing
- config loading
- run directory creation
- report path output
- fix prompt generation

### Browser / demo

```bash
pnpm demo:checkout
pnpm personabench run --config examples/run-config.checkout.json
pnpm personabench report --latest
```

Expected artifacts:

```txt
run.json
personas.json
events.ndjson
friction-signals.json
findings.json
interview.md
report.html
```

---

## 12. Commit Rules

**Every iteration MUST end with at least one git commit.** No exceptions. The commit is the iteration boundary — without it, the iteration did not complete and the loop must mark the iteration as failed.

This is the **single non-negotiable git invariant** in Ralph Mode. Branching strategy, merge cadence, who pushes where — all of those are flexible and may differ per team or per agent topology (see Section 24). The commit-per-task rule is not flexible.

Why it matters:

- git history is the **persistent memory** between fresh agent contexts
- without per-iteration commits, the loop cannot recover from a crashed iteration
- progress visibility (and the time-budget hook's pacing decisions) depends on it
- multi-agent attribution depends on machine-readable trailers in commit bodies
- the Definition of Done explicitly requires "git history shows task-by-task progress"

### Commit per outcome

| Outcome | Action | Commit message format |
|---|---|---|
| Task completed | Implementation + tests + verification → commit | `feat(scope): <change>` |
| Task partially done but useful | Save what's working + tests → commit, mark task `in_progress` if continuing next iteration | `wip(scope): partial <change>` |
| Task blocked | Document the block + any reproducer → commit, mark task `blocked` | `chore(ralph): mark TASK-N blocked` |
| Verification failed but state still useful | Commit revert or repair → commit | `fix(scope): repair <thing>` |
| Iteration produced no useful change | **Stop the loop and ask for human input.** Do not commit empty work, but do not silently continue either. | n/a |

### Required commit message body

Every Ralph commit body must contain these trailers (machine-parsable so dashboards can read git log):

```txt
<short subject under 72 chars>

<optional body explaining why>

Ralph-Task: TASK-NNN
Ralph-Iteration: <number>
Ralph-Agent: claude-code
Ralph-Pattern: A | B | C | D                  # see Section 24
Ralph-Subagents: phase-tester, spec-reviewer  # optional, comma-list of sub-agents consulted
Status: completed | in_progress | blocked | failed
Verification:
- <command 1>: <pass | fail>
- <command 2>: <pass | fail>
```

For blocked or failed status, also include:

```txt
Reason: <one sentence>
Next: <smallest next action>
```

### Examples

Completed task:

```txt
feat(personas): add NemotronNormalizer with locale-agnostic mapping

Maps every column in the Korea shard's parquet to PersonaRecord;
unknown columns flow into narratives.raw without being dropped.

Ralph-Task: TASK-004
Ralph-Iteration: 7
Ralph-Agent: claude-code
Ralph-Pattern: B
Ralph-Subagents: dataset-validator
Status: completed
Verification:
- pnpm --filter @personabench/personas test: pass
- pnpm typecheck: pass
```

Phase-completion commit (Pattern C):

```txt
feat(personas): complete Phase 2 — persona layer

Ralph-Task: PHASE-2-COMPLETE
Ralph-Iteration: 12
Ralph-Agent: claude-code
Ralph-Pattern: C
Ralph-Subagents: phase-tester, spec-reviewer, dataset-validator
Status: completed
Verification:
- pnpm --filter @personabench/personas test: pass (24/24)
- pnpm typecheck: pass
- phase-tester report: ready=yes, coverage gaps=none
- spec-reviewer audit: all acceptance criteria met
```

Blocked task:

```txt
chore(ralph): mark TASK-014 blocked

Ralph-Task: TASK-014
Ralph-Iteration: 19
Ralph-Agent: claude-code
Ralph-Pattern: A
Status: blocked
Verification:
- pnpm --filter @personabench/runner test: fail (3 of 12)
Reason: Playwright cannot launch chromium under the current sandbox; browser binaries missing in CI image.
Next: add `pnpm exec playwright install chromium` to preflight.sh and rerun TASK-014.
```

### Hard rules

- Do not squash. Each task-unit commit is separately auditable.
- Do not amend a commit from a previous iteration (the previous iteration owns it).
- Do not skip the commit when the time-budget hook hits CRITICAL — the hook explicitly says "stop new work, commit what you have."
- Do not skip hooks (`--no-verify`, `--no-gpg-sign`, etc.). If a pre-commit hook fails, fix the underlying issue and create a NEW commit.

---

## 13. Progress File

`.ralph/progress.md` should be append-only.

Template:

```md
## Iteration 007

Task: TASK-005 Add persona compiler
Status: completed
Commit: abc123

What changed:
- Added PersonaCompiler
- Added prompt block generation
- Added tests for provenance preservation

Verification:
- pnpm --filter @personabench/personas test
- pnpm typecheck

Learnings:
- Persona source attribution should be rendered from `record.source.attribution`.
- Avoid putting raw narrative fields directly into agent prompts.
```

---

## 14. Learnings File

`.ralph/learnings.md` contains durable project knowledge.

Examples:

```md
# Learnings

- Use Zod schemas in `packages/core/src/schemas`; do not duplicate validation in apps.
- Persona provenance must be preserved through compiler, run artifacts, and reports.
- Mock personas must use ids prefixed with `mock_`.
- Browser runner safety checks live in `packages/runner/src/safety`.
- Analyzer tests should use deterministic event fixtures, not live browser runs.
```

Agents should update this file when they discover project conventions or pitfalls.

---

## 15. Autonomous Prompt Template

Use this as the loop prompt.

```txt
You are running in Ralph Mode for PersonaBench.

You are one fresh iteration in an autonomous coding loop.
Do not ask the human for help unless blocked by safety, missing credentials, or contradictory requirements.

Read:
- AGENTS.md
- .ralph/prd.json
- .ralph/progress.md
- .ralph/learnings.md
- .ralph/status.json
- the selected task file

Your job:
1. Work on exactly one selected task.
2. Keep the change scoped.
3. Add or update tests.
4. Run the task verification commands.
5. Run relevant global checks if feasible.
6. Update task status.
7. Append progress.
8. Add durable learnings.
9. Commit if and only if the task is complete or a useful blocked-state update is needed.

Product invariants:
- PersonaBench must use data-grounded persona records.
- Preserve Nemotron-Personas provenance.
- Do not implement production personas as prompt-only personas.
- UX findings must link to behavioral evidence.
- Browser runner must block real payment and destructive actions.
- Do not claim synthetic personas replace real user research.

If you cannot complete the task:
- mark it blocked
- write the exact reason
- write the smallest next action needed
- do not invent requirements
```

---

## 16. PersonaBench-Specific Ralph Safety

PersonaBench includes browser automation, so Ralph must not accidentally create dangerous behavior.

### Forbidden by default

```txt
- real payment submission
- account deletion
- sending production emails
- accessing production admin panels
- scraping private data
- uploading secrets
- committing `.env`
- storing browser cookies in reports
```

### Required safety implementation tasks

Make these early tasks, not later polish:

```txt
TASK-SAFE-001 Add domain allowlist
TASK-SAFE-002 Add payment/destructive action blocker
TASK-SAFE-003 Add sensitive field redaction
TASK-SAFE-004 Add artifact access policy
TASK-SAFE-005 Add prompt injection warning to browser agent prompt
```

---

## 17. Ralphthon Mode

For a hackathon-style Ralphthon build, optimize for visible demo value.

### Human preparation window

Before starting:

1. Write PRD.
2. Create task queue.
3. Prepare example checkout app spec.
4. Define demo script.
5. Define verification commands.
6. Configure loop budget.
7. Run pre-flight environment checklist (see below).
8. Start Ralph.

### Pre-flight environment checklist

Run these before the loop kicks off. Anything that requires network, large downloads, or interactive auth must complete *now* — the loop should never block on external systems.

**Dataset (offline-ready)**

- Download `nvidia/Nemotron-Personas-Korea` to a local cache so the loop has zero network dependency:
  ```bash
  pip install -U huggingface_hub
  huggingface-cli download nvidia/Nemotron-Personas-Korea \
    --repo-type dataset \
    --local-dir data/personas/nemotron-korea
  ```
- The dataset is public on Hugging Face — no token required.
- Record the cache path in `.ralph/loop-config.json` so source adapters and tests resolve it deterministically.
- Korea is the only locale exercised by automated tests during this build (see `AGENTS.md` "Locale verification scope"). Other Nemotron-Personas-* locales remain code-supported but are not downloaded.

**Toolchain**

- Node + pnpm (pin in `package.json` engines or `.nvmrc`).
- Python 3.x with `huggingface_hub` and `pyarrow` for the HF helper script and parquet inspection.
- DuckDB is the local query engine for `LocalParquetNemotronSource` — no separate install needed (Node bindings install via pnpm).
- Playwright browsers pre-installed: `pnpm exec playwright install chromium`. Skipping this means the first browser-test iteration eats download time.

**Storage (file-based)**

- No DB provisioning. The build writes everything under `.personabench/runs/<runId>/` per the storage layout in `docs/02_ARCHITECTURE.md`.
- DuckDB queries parquet files directly — no schema migration, no server.
- The hosted product (Postgres + pgvector + separate API server) is a different track entirely; not built here.

**Secrets**

- LLM API key for the runner's `DecisionProvider` (Claude API). Set in `.env` or shell — never commit.
- HF token only needed if a gated dataset is added later. Korea is public.

**Verification gates green on clean clone**

Before starting, on a fresh checkout:

```bash
pnpm install && pnpm build && pnpm typecheck && pnpm lint && pnpm test
```

If any gate fails on baseline, fix it before the loop — Ralph cannot recover from a broken baseline.

**Loop budget**

- Iteration cap, time window, and deadline match the time-budget tracking hook (see below).
- `.ralph/loop-config.json` records the cap so the loop self-terminates.

### Human behavior during build

Allowed:

- monitor dashboard/logs
- update steering file between iterations
- restart failed sandbox
- stop unsafe loop

Not allowed:

- manually patch implementation
- manually fix tests
- secretly write code

### Demo target

By the end, the system should show:

```txt
1. Persona source selection
2. Persona-based run against checkout example
3. Event log
4. Friction signal
5. Finding
6. Interview excerpt
7. Fix prompt
8. Local report
```

Even if the hosted UI is incomplete, the loop is successful if the CLI and report demonstrate the full product thesis.

### Time-budget tracking hook (작업 단위 시간 추적)

For time-boxed Ralphthon sessions, register a `UserPromptSubmit` hook that injects elapsed/remaining time and a status label into Claude's context at the start of every loop iteration. This makes the agent self-pace: as the deadline approaches, the injected status flips from `active` → `WARNING` → `CRITICAL` → `PASSED`, instructing the model to drop new feature work in favor of integration, verification, and commit.

#### Files

```txt
.claude/
  hooks/
    time-status.sh        # computes time + emits hookSpecificOutput JSON
    time-status.log       # append-only audit trail (gitignored)
  settings.local.json     # registers UserPromptSubmit hook (gitignored)
.gitignore                # excludes settings.local.json + *.log
```

#### Hook script (`.claude/hooks/time-status.sh`)

Reads two ISO timestamps (`START_ISO`, `DEADLINE_ISO`), computes elapsed/remaining, classifies status, and emits:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "[자동 실행 시간 추적 — 작업 단위 체크포인트]\n- 현재 시각: ...\n- 경과: ...\n- 남은 시간: ...\n- 상태: ..."
  }
}
```

Status thresholds:

```txt
remaining > 30m       -> active
remaining <= 30m      -> WARNING (핵심 기능 마무리 우선)
remaining <= 10m      -> CRITICAL (신규 기능 중단, 통합/검증/커밋만)
remaining <= 0        -> PASSED (즉시 마무리)
```

Edit `START_ISO` / `DEADLINE_ISO` constants in the script to set the session window. Use KST offset `+0900` and macOS `date -j -f` for parsing.

#### Settings registration (`.claude/settings.local.json`)

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash /absolute/path/.claude/hooks/time-status.sh",
            "timeout": 5,
            "statusMessage": "Checking session time budget..."
          }
        ]
      }
    ]
  }
}
```

Use absolute path — relative paths are resolved against an unspecified cwd.

#### Activation

Claude Code's settings watcher only watches directories that already contained a settings file when the session started. If `.claude/` was created mid-session, you must trigger a reload before the autonomous run starts:

```txt
1. Open /hooks once (reloads config in the current session), OR
2. Restart the Claude Code session.
```

Verify activation by checking that the next prompt's response reflects the injected time context, or by tailing `.claude/hooks/time-status.log` — every iteration appends a line.

#### Why `UserPromptSubmit`, not `PostToolUse`

`PostToolUse` fires after every tool call (10s of times per iteration), creating noise without adding signal. `UserPromptSubmit` fires once per ralph-loop iteration — the natural "task unit" boundary. The injected `additionalContext` is read by the model before any work begins, so pacing decisions happen up-front, not retroactively.

#### Anti-patterns

- Hardcoding the deadline as a literal in the loop prompt: changes require restarting the loop. Prefer the hook so the model gets fresh time on every iteration.
- Using `Stop` hook for time injection: `Stop` runs after the turn ends, too late to influence the work that just happened.
- Skipping the `/hooks` reload: a silent watcher means the hook never fires and the agent has no time awareness.

### Demo integrity gates (G1–G4)

The time-budget hook protects against time *underrun*. These gates protect against time *overrun masquerading as completion* — i.e., the loop running out of new tasks while the demo is silently broken. The loop must not declare the demo path complete until G1, G2, G3, and G4 are all green. They are checked once per iteration after any change to the demo path (analyzer, CLI, example app, report, web app, or distribution).

- **G1 — Friction surface lives.** A single run of `personabench run --config examples/run-config.checkout.json` on `examples/ecommerce-checkout` produces ≥3 `FrictionSignal` entries and ≥1 `UXFinding` with severity `high` or `critical`. This is evidence that the example app's intentional UX flaws are still triggering detection — without it, the demo is empty even if all unit tests pass.
- **G2 — Fix loop closes.** Apply the generated `fix-prompts/F-001.md` to `examples/ecommerce-checkout` (the loop applies it itself), rerun, then `personabench compare <runA> <runB>`. The previously-failing finding must appear under `resolved`. Without this, "fix prompts" is theatre.
- **G3 — One-command demo.** `pnpm personabench demo` (a single composite script the bootstrap creates) brings up the example app on port 3100, runs `personabench run` against it, generates `report.html`, and opens it — start to finish in ≤2 minutes. Without this, the live demonstration becomes an exercise in juggling four terminals.
- **G4 — Clone-and-install distribution.** PersonaBench must be usable from any directory and any external Claude Code / Codex session by cloning this repo and running `pnpm install && pnpm -r build && pnpm personabench install`. npm publishing is not available in this build environment (corporate hackathon security restriction). Sub-gates:
  - **G4-a.** `packages/cli/package.json` declares `"bin": {"personabench": "dist/bin.js"}`. `pnpm personabench install` runs `pnpm -F @personabench/cli link --global` so `personabench --version` exits 0 from any working directory.
  - **G4-b.** `personabench install` adds an idempotent `mcpServers.personabench` entry to `~/.claude/settings.json` (preserving other keys); after restart, an external Claude Code session can call `run_persona_ux_test`.
  - **G4-c.** `personabench install` symlinks `plugins/claude-code/` into `~/.claude/plugins/personabench/`. The `--codex` flag opts into a parallel Codex skill install.
  - **G4-d.** `personabench uninstall` reverses G4-a/b/c cleanly so a developer can remove the install without leaving artifacts in a corporate-managed environment.
  - **G4-e.** Verification scenario: in a fresh `mktemp -d`, `personabench --version`, `personabench run --help`, and `personabench mcp --help` all exit 0. `personabench uninstall` then leaves `~/.claude/settings.json` and `~/.claude/plugins/` as they were before install.

If any gate is red the loop's next iteration must be a repair iteration on the gate, not new feature work. Repair iterations follow Pattern A unless safety-auditor or dataset-validator territory is touched.

### Stretch queue (S1–S10) when time-budget remains `active`

If the demo path is green (G1–G3 pass) and the time-budget hook is still `active`, the loop pulls from this ordered queue. Top of queue first; do not skip ahead. Items below the active item exist; items above it are done. The queue is appended to `.ralph/stretch-queue.md` at bootstrap and updated on each completion.

1. **S1 — Before/after compare on a real fix.** Apply a fix prompt by hand-editing `examples/ecommerce-checkout`, rerun, render `compare.html`. This is the dogfood demo — by far the highest-impact addition.
2. **S2 — Multi-persona run.** Three to five different Korean personas run against the same flow in one invocation; each produces a distinct friction trace. Verifies sampling diversity.
3. **S3 — Live web run.** `/runs/:runId` polls and shows live step counter + latest event line; on completion the page flips to replay viewer (trace.zip embedded) + finding cards.
4. **S4 — Persona pack save/reuse.** Search on `/personas` → "Save as pack" → on `/runs/new` reuse the saved pack as the persona source.
5. **S5 — MCP smoke.** A second Claude Code session connects to `pnpm personabench mcp` and successfully invokes `run_persona_ux_test`.
6. **S6 — Locale-agnostic proof.** A one-row English NDJSON fixture loaded through `LocalJsonPersonaSource` runs end-to-end. No code change required.
7. **S7 — CI workflow.** `.github/workflows/ci.yml` runs `pnpm install && pnpm -r build && pnpm -r typecheck && pnpm -r test` on a clean ubuntu-latest runner.
8. **S8 — README quickstart.** Top-level `README.md` with install command, `pnpm personabench demo` invocation, and one screenshot of `report.html`.
9. **S9 — `report.html` snapshot.** Byte-stable snapshot test for a fixture run; future regressions surface in CI.
10. **S10 — rrweb / video.** Wire up the deferred Phase 4 recorder paths if (and only if) all of S1–S9 are committed.

### Forbidden during `active` (even with time to spare)

Time left does not mean license to roam. The following are off-limits even when the time-budget hook is green:

- Refactor, rename, or reorganize anything not directly required by an open task or stretch queue item.
- Introduce new packages or tooling not declared in this guide (no turbo, nx, changesets, husky, jest, eslint, prettier, mocha, pnpm-deploy, etc.).
- Implement any hosted-track feature from `docs/11_OPEN_SOURCE_AND_ENTERPRISE_SPLIT.md` (auth, multi-tenant, pgvector, separated API server, billing).
- Premature optimization: caching layers, indexing, parallel execution, worker pools.
- Try a different LLM model (only `claude-haiku-4-5-20251001` for runtime decisions and `claude-sonnet-4-6` for analyzer reasoning are sanctioned).
- Add abstractions, interfaces, or extension points "for the future."
- Write code without tests (the only exception is documentation and the example app's deliberately-flawed UI).

If the loop catches itself wanting to do one of the above, the right move is to pull the next item from the stretch queue or, if S10 is done, commit a `chore(ralph): stretch queue exhausted` marker and idle until the time-budget transitions out of `active`.

---

## 18. Observability for Ralph Mode

Create a simple status dashboard if time allows.

Minimum status file:

`.ralph/status.json`

```json
{
  "currentIteration": 12,
  "currentTaskId": "TASK-009",
  "currentTaskTitle": "Add finding generator",
  "startedAt": "2026-05-01T12:00:00Z",
  "lastUpdatedAt": "2026-05-01T12:15:00Z",
  "completedTasks": 8,
  "blockedTasks": 1,
  "failedIterations": 2,
  "lastCommit": "abc123",
  "lastVerification": {
    "command": "pnpm test",
    "status": "passed"
  }
}
```

Optional dashboard:

```txt
.ralph/artifacts/status.html
```

Show:

- current task
- completed tasks
- blocked tasks
- latest log
- latest commit
- latest verification result
- elapsed time
- cost estimate if available

---

## 19. Suggested `ralph-loop.sh`

This is pseudocode; adapt to the chosen coding CLI.

```bash
#!/usr/bin/env bash
set -euo pipefail

MAX_ITERATIONS="${1:-50}"

for i in $(seq 1 "$MAX_ITERATIONS"); do
  echo "=== Ralph iteration $i ==="

  ./scripts/ralph/preflight.sh

  TASK_ID=$(pnpm tsx scripts/ralph/select-next-task.ts)
  if [ "$TASK_ID" = "COMPLETE" ]; then
    echo "All tasks complete."
    exit 0
  fi

  pnpm tsx scripts/ralph/update-task-status.ts "$TASK_ID" in_progress

  claude -p "
You are running in Ralph Mode.
Read AGENTS.md, .ralph/prd.json, .ralph/progress.md, .ralph/learnings.md, and .ralph/tasks/$TASK_ID.json.
Complete exactly this task.
Run verification.
Update progress and task status.
Commit if complete.
"

  ./scripts/ralph/verify.sh || {
    echo "Verification failed after agent iteration."
    pnpm tsx scripts/ralph/update-task-status.ts "$TASK_ID" failed
    exit 1
  }
done

echo "Budget exhausted."
exit 2
```

---

## 20. Practical Operating Modes

### Mode A: Safe HITL warmup

Use for first 3-5 iterations.

```bash
./scripts/ralph/ralph-loop.sh 1
```

Human watches logs but does not edit code.

Goal:

- refine task sizes
- catch missing verification commands
- improve AGENTS.md

### Mode B: AFK implementation

Use after warmup.

```bash
./scripts/ralph/ralph-loop.sh 30
```

Goal:

- implement many small tasks
- rely on verification gates

### Mode C: Stabilization loop

Use near demo.

```bash
./scripts/ralph/ralph-loop.sh 10
```

Steering:

```md
Only fix failing tests, broken demo flow, and report generation.
Do not add new features.
```

---

## 21. Anti-patterns

### Anti-pattern: vague PRD

Bad:

```txt
Make it good.
```

Fix:

```txt
Define exact artifacts, commands, schemas, and acceptance criteria.
```

### Anti-pattern: no tests

Ralph without tests becomes unattended vibe coding.

Fix:

```txt
Every task must have verification.
```

### Anti-pattern: huge tasks

Large tasks create context collapse.

Fix:

```txt
Split tasks until one task can be one commit.
```

### Anti-pattern: hidden human patches

This destroys the experiment and the loop memory.

Fix:

```txt
All changes must happen through tracked tasks and commits.
```

### Anti-pattern: agent keeps adding scope beyond the PRD

Fix:

```txt
Steering file says: only build what is described in docs/01_PRD.md;
no integrations, dashboards, or features not present in that PRD.
The hosted-product features in docs/11_*.md are explicitly off-limits for this run.
```

---

## 22. PersonaBench Ralph Definition of Done

Ralph Mode is successful when:

```txt
- all tasks in the queue are completed, or graceful-degraded by the time-budget hook
- repo builds from clean clone
- tests pass (Korea-locale verification scope; see docs/03_PERSONA_DATA_LAYER.md)
- lint and typecheck pass
- CLI can run a sample UX test end-to-end against examples/ecommerce-checkout
- web app launches via `personabench serve` and runs the same flow without touching a terminal
- report.html is generated and is self-contained
- at least one finding has linked evidence
- at least one fix prompt is generated
- before/after compare works on two runs
- safety rules are implemented for browser runner
- AGENTS.md and docs reflect current architecture
- git history shows task-by-task progress
- demo integrity gates G1, G2, G3, G4 (§17 "Demo integrity gates") all pass
- if time-budget remained `active` after the demo path closed, stretch queue items S1..Sn are committed in order with no skips
```

---

## 23. Final Instruction to Coding Agents

When building PersonaBench in Ralph Mode:

```txt
Prefer boring, verifiable progress over clever architecture.

The product is already ambitious.
The implementation loop must be disciplined.
```

---

## 24. Sub-agent and agent-team strategy (single Claude Code session)

PersonaBench is built by **one Claude Code session** running the Ralph loop on a single git branch. Within that session, the main thread orchestrates **sub-agents** for specialized work — codebase research, planning, phase testing, spec review, safety audit, dataset validation. Sub-agents protect the main thread's context from being saturated by raw tool output and let the loop pursue verification work in parallel without spinning up a second CLI.

This section defines:

1. The four custom sub-agents to register under `.claude/agents/`
2. Four agent-team patterns (A/B/C/D) the main thread picks per iteration
3. The mandatory phase-boundary testing pattern (Pattern C)

### 24.1 Custom sub-agents

Each lives as a markdown file under `.claude/agents/<name>.md` with frontmatter declaring tools and (optionally) model. Definitions are project-scoped so they evolve with the codebase.

#### `phase-tester`

Runs the full test suite for a specified phase, summarizes failures with file/test/error/suggested fix, and returns a structured report. Read-write Bash + Read/Grep — does **not** edit code (that is main thread's job).

Frontmatter:

```yaml
---
name: phase-tester
description: Run all tests for a completed Phase, summarize pass/fail, list coverage gaps, and decide whether the phase is ready for sign-off. Use proactively at every phase boundary.
tools: Bash, Read, Grep, Glob
model: sonnet
---
```

Trigger: every phase-completion commit. Spawned as part of Pattern C.

#### `spec-reviewer`

Cross-checks generated code against acceptance criteria from `docs/01_PRD.md` and the task file's `acceptanceCriteria`. Read-only.

Frontmatter:

```yaml
---
name: spec-reviewer
description: Audit recently changed files against the acceptance criteria in the relevant task file and docs/01_PRD.md. Returns a checklist of met/unmet criteria with file:line citations.
tools: Read, Grep, Glob
model: sonnet
---
```

Trigger: at phase boundary (Pattern C), and any time the main thread is uncertain whether implementation meets the spec.

#### `safety-auditor`

Scans browser-runner code for unsafe patterns: real payment submission, unmasked PII in event logs, allowlist bypass, prompt-injection vulnerability in agent prompts, missing redaction on configured selectors.

Frontmatter:

```yaml
---
name: safety-auditor
description: Scan packages/runner and packages/recorder for unsafe browser automation patterns: payment submission paths, allowlist bypass, unmasked secrets in logs, prompt-injection risk in DecisionProvider input. Returns a severity-ranked list with file:line.
tools: Read, Grep, Glob
model: sonnet
---
```

Trigger: after any change to `packages/runner` or `packages/recorder`, and once at end of build before final commit.

#### `dataset-validator`

Spot-checks `LocalParquetNemotronSource` outputs and `NemotronNormalizer` correctness against the local parquet shards.

Frontmatter:

```yaml
---
name: dataset-validator
description: Spot-check that DuckDB queries on data/personas/nemotron-korea/*.parquet return rows matching PersonaRecord schema, that provenance fields are preserved, and that unknown columns flow into narratives.raw. Run a few representative queries (locale filter, age range, occupation substring) and report mismatches.
tools: Bash, Read
model: sonnet
---
```

Trigger: after changes to persona normalizer, source adapter, or DuckDB query layer.

### 24.2 Agent-team patterns

Patterns are named so the autonomous prompt and commit messages can reference them (`Ralph-Pattern: A | B | C | D`). The main thread picks at iteration start.

#### Pattern A — Solo iteration (default)

```txt
main thread: implement → run tests inline → commit
```

Use when:

- single-file change
- no cross-package impact
- spec is straightforward

This will be most iterations.

#### Pattern B — Research-first iteration

```txt
main thread → Explore (find relevant files / prior art)
            → Plan (design the approach)
            → main thread (implement)
            → commit
```

Use when:

- non-trivial design decision (e.g., DecisionProvider interface, friction event model, replay viewer state machine)
- main thread lacks context it needs to start coding

#### Pattern C — Phase-boundary iteration (mandatory at every phase)

```txt
main thread: complete the last task in Phase N
  → phase-tester (run full Phase N test suite, return report)
  → spec-reviewer (audit acceptance criteria from PRD + task files)
  → safety-auditor (only if Phase N touched runner/recorder)
  → dataset-validator (only if Phase N touched personas)
  → main thread (fix any gaps surfaced by the reports)
  → phase-tester (re-run, confirm green)
  → main thread (commit with subject "feat(<scope>): complete Phase N — <name>")
```

Use when:

- a Phase from `docs/08_IMPLEMENTATION_PLAN.md` is complete
- before incrementing to the next Phase

**This is the mandatory testing pattern for phase boundaries.** No phase is signed off without the phase-tester returning `ready: yes`.

#### Pattern D — Parallel-implementation iteration

```txt
main thread spawns:
  general-purpose A: implement feature X (writes code in package A)
  general-purpose B: write tests for feature X (writes test files)
  → main thread: integrate, run combined tests, commit
```

Use when:

- task has clear sub-pieces that don't share state mid-implementation (impl + tests, or two unrelated files)
- time-budget hook is in the green (`active`)
- main thread context is approaching saturation

Cost: more API tokens. Use sparingly.

### 24.3 Phase-tester structured report contract

The `phase-tester` sub-agent must return this shape so the main thread can decide deterministically:

```txt
PHASE N TEST REPORT
- phase: <number> <name>
- total tests: <n>
- passing: <n>
- failing: <n>
- failures:
    - <file>::<test name>: <error> → suggested fix: <one-liner>
- skipped (with reason): <list>
- coverage gaps: <files in scope without any test reference>
- ready for phase-complete commit: yes | no
- if no, blocking issues:
    - <issue 1>
    - <issue 2>
```

Main thread does not commit a phase-complete tag until `ready: yes`.

### 24.4 Iteration prompt update

The autonomous prompt (Section 15) must reference patterns explicitly. Add this block to the prompt:

```txt
At iteration start:

1. Read .ralph/status.json → identify current Phase and current task.
2. Choose pattern:
   - At a phase boundary (last task of Phase N just completed)? → Pattern C (mandatory).
   - Non-trivial design decision required? → Pattern B.
   - Task has independent sub-pieces and time budget is green? → Pattern D.
   - Otherwise → Pattern A.
3. Execute the pattern.
4. Commit per Section 12 with Ralph-Pattern set, and Ralph-Subagents listing any sub-agents consulted.
```

### 24.5 Why no second CLI

Earlier drafts of this guide explored Codex parallelism. For PersonaBench:

- the sub-agent system already covers the "parallel implementation" use case (Pattern D)
- single-CLI keeps git history linear and the time-budget hook authoritative
- coordination overhead (dual `.ralph/` state, lane discipline, branch merging) exceeds the gain at the 3.5-hour budget
- recovery from a stuck iteration is one-tree-walk, not two

If a future build wants multi-CLI parallelism, the lane-based design is reconstructible from this guide's git history — but it is intentionally not part of the active plan.

### 24.5b Sub-agent budget cap

Sub-agents are not free. Each `phase-tester`, `spec-reviewer`, `safety-auditor`, and `dataset-validator` invocation consumes its own context window plus the main thread's tokens to brief and digest the response. To prevent Pattern C from devouring the iteration budget on a single phase:

- A single phase boundary may consult sub-agents at most **four times in total** across all four agent types. The most common shape is `phase-tester` (run) → main thread (fix) → `phase-tester` (re-run) → `spec-reviewer` (audit), totalling three; the fourth slot is reserved for `safety-auditor` or `dataset-validator` when the phase touched their territory.
- If after the fourth call the phase still cannot be signed off, the main thread takes over: it reads the failures itself, fixes them, runs the declared test command directly, and either commits the phase-complete tag or downgrades the offending feature into the `.ralph/spec-changes.md` log per the self-bypass policy in the loop prompt.
- The cap applies per phase, not per iteration. A phase that spans multiple iterations still gets only four sub-agent calls in total at its boundary.
- `Explore` and `Plan` (built-in, used in Pattern B) are not counted against this cap; they are research tools, not verification gates.

This rule deliberately favors progress over thoroughness near phase boundaries. The time-budget hook does the same at session boundaries, so the two budgets compose.

### 24.6 Observability

Every commit's `Ralph-Pattern` and `Ralph-Subagents` trailers make per-iteration decisions auditable from `git log` alone:

```bash
# how many phase-boundary iterations
git log --grep "^Ralph-Pattern: C" --oneline

# which iterations consulted phase-tester
git log --grep "phase-tester" --oneline

# pattern distribution
git log --grep "^Ralph-Pattern:" --pretty=%b | grep "^Ralph-Pattern:" | sort | uniq -c
```

Combine with the time-budget hook log (`.claude/hooks/time-status.log`) to see whether sub-agent usage correlates with budget pressure.
