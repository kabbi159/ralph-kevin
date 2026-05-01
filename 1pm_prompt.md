# 1pm Ralph Boot Prompt — PersonaBench

> 13:00 KST 정각, 새 Claude Code 세션에서 `/hooks` 한 번 연 뒤 아래 블록을 그대로 복붙하면 됩니다. 시간 추적 훅은 매 iteration 시작 시 active / WARNING(≤30m) / CRITICAL(≤10m) / PASSED 상태를 자동 주입합니다.

---

PersonaBench를 Ralph Mode로 자율 구현한다.
세션 윈도우는 13:00~16:30 KST. `.claude/hooks/time-status.sh`가 매 iteration 시작 시
active / WARNING / CRITICAL / PASSED 상태를 주입한다. 이 신호로 자체 페이싱하라.

## 유일한 종료 조건

- 시간 예산 = PASSED (deadline 도달).
그 외 어떤 막힘에도 사람을 호출하지 말고 스스로 우회한다.

## 자가-우회 정책 — 막히면 이 순서로 적용

1. 동일 task 2회 실패 → task를 더 작게 쪼개거나 범위 축소해서 재정의.
2. 같은 Phase 안에서 또 막히면 → 해당 Phase 비핵심 기능을 `.ralph/spec-changes.md`에 기록하면서 잘라낸다.
3. 외부 시스템 / 자격증명 부재 → mock·stub·copy-paste fallback로 대체. 절대 사람에게 키를 묻지 않는다.
4. 문서 간 모순 → `docs/01_PRD.md`를 직접 수정해 일관성을 만든다 (해당 변경은 `.ralph/spec-changes.md`에 동시 기록).
5. 그래도 안 되면 → 그 task를 `skipped`로 마킹하고 다음 우선순위로 진행. 데모 경로(P0/1/2/3/5/6/7/example/8) 유지가 최우선.

## 절대 깨면 안 되는 것 — 우회 대상이 아님

- `AGENTS.md` 비협상 불변식: prompt-only persona 금지, Nemotron provenance 보존, 실결제·파괴행위 금지, secrets/PII/쿠키 마스킹, 실 사용자 리서치 대체 표현 금지.
- `docs/07_SECURITY_PRIVACY.md`의 도메인 allowlist / 결제차단 / 민감필드 redaction.
- 자동 검증은 `nvidia/Nemotron-Personas-Korea` 한정 (다른 로케일은 코드 경로만 지원).

이 셋은 "스펙 변경"으로도 풀 수 없다. 위반 가능성이 보이면 그 코드 경로를 잘라낸다.

## 부트스트랩 (iteration 0, 단 1회)

**A. 정독.**
`AGENTS.md` / `RALPH_LOOP_AUTONOMOUS_BUILD_GUIDE.md` (특히 §4·5·7·12·15·17·22·24) / `docs/01_PRD.md` / `docs/02_ARCHITECTURE.md` / `docs/03_PERSONA_DATA_LAYER.md` / `docs/04_RUNNER_ANALYZER_SPEC.md` / `docs/06_API_SCHEMA.md` / `docs/07_SECURITY_PRIVACY.md` / `docs/08_IMPLEMENTATION_PLAN.md` / `docs/12_FIRST_ISSUES.md`.

**B. 사전 결정 사항 (이미 검증 완료, 그대로 채택).**

- **브라우저 substrate**: **`agent-browser` (Vercel Labs, npm: `agent-browser@0.26.0+`).** Playwright 직접 사용 금지 (단, agent-browser 내부적으로 Playwright/CDP를 쓰는 건 허용). 아래 커맨드만 subprocess로 호출:
  - `agent-browser --session <runId> open <url> [--allowed-domains a,b] [--viewport mobile|wxh]`
  - `agent-browser --session <runId> snapshot --json` → `{success, data:{origin, snapshot, refs:{e1:{role,name},…}}}` 파싱해서 observation으로
  - `agent-browser --session <runId> click @<ref> | fill @<ref> "<text>" | scroll <dir> | press <key> | back | screenshot <path> | trace start|stop | close`
  - **`agent-browser chat` 절대 사용 금지**. Vercel AI Gateway 의존이고 시스템 프롬프트가 고정이라 persona 주입 불가.
  - Chrome 바이너리는 사람이 미리 깔아둠 (`~/.agent-browser/browsers/chrome-148.0.7778.97`). `pnpm exec agent-browser install` 추가 호출 불필요.
- DecisionProvider: 자체 구현. **Anthropic SDK 직접 호출.** 모델: `claude-haiku-4-5-20251001`(실시간 결정), `claude-sonnet-4-6`(finding/interview/fix-prompt). 키: `process.env.ANTHROPIC_API_KEY` (`.env` 로딩). Vercel AI Gateway 의존 금지.
- DuckDB 바인딩: `@duckdb/node-api@^1.5.2`. 레거시 `duckdb` 패키지 금지(pnpm 10이 native build를 차단함).
- 데이터셋 경로: `data/personas/nemotron-korea/data/train-*.parquet` (9 shards, 1,000,008 rows × 26 cols). **age 분포는 17·18 없고 19부터 시작**. 따라서 "10대 후반"은 코드 경로 상 `ageMin: 19, ageMax: 19`로 매핑. 19세 + 판타지/웹툰/소설 키워드 포함 페르소나 ≥3,050명 확보됨.
- 테스트: vitest. 린트/포맷: biome. `lint` 스크립트는 `biome check --write src`로 auto-fix.
- 워크스페이스 러너: `pnpm -r` (turbo 도입 금지).
- Next.js 15 App Router (`apps/web`). shadcn 셸 생략, Tailwind + 직접 컴포넌트.
- `rrweb=false` 기본. `trace`/`video`는 옵션. 데모 흐름엔 필수 아님.
- 포트: 웹앱 3000, `examples/ecommerce-checkout` **3100**. `RunConfig.targetUrl`도 3100으로 정렬.
- persona id: `nemotron:<dataset>:<rowId-or-uuid>` / `mock_<n>` / `custom:<dataset>:<id>`.
- `narratives.raw`는 first-class 외 모든 컬럼 catch-all (`military_status`, `bachelors_field` 등 포함).
- 통합: copy/paste fallback만 의무. gh / Linear / Jira는 토큰 없으면 graceful no-op.
- `.ralph/iteration-logs/`, `.personabench/runs/`는 gitignore 대상.

**C. 다음을 생성/검증한다 (없을 때만).**

- `.ralph/{prd.json, progress.md, learnings.md, steering.md, status.json, spec-changes.md, stretch-queue.md, tasks/TASK-*.json}`
- `scripts/ralph/{preflight.sh, verify.sh, select-next-task.ts, update-task-status.ts}`
- 루트 `package.json` / `pnpm-workspace.yaml` / `tsconfig.base.json` / `biome.json` / `vitest.config.ts`
- `packages/{core,personas,runner,recorder,analyzer,cli,mcp-server,integrations,ui}`
  - `packages/runner`는 `agent-browser`를 subprocess로 driving하는 클래스(`AgentBrowserSession`) 포함. Playwright import 금지.
- `apps/web` (Next.js 15, port 3000)
- `examples/ecommerce-checkout` (Next.js, port 3100, 의도적 결함 포함). **G1·G2 게이트 검증 대상**.
- `examples/run-config.checkout.json` (이미 존재) 그대로 G1·G2에 사용.
- `examples/run-config.crack.json` (이미 존재): 라이브 데모 시나리오. 10대 후반 신규 유저가 https://crack.wrtn.ai/ 에서 판타지 스토리 탐색. agent-browser allowlist는 `crack.wrtn.ai`, `wrtn.ai`. **로그인·가입·결제·메시지 전송은 safety policy로 차단**. 이 시나리오는 데모용이며 G1·G2 게이트 후보가 아니다 (라이브 사이트엔 fix 적용 못 하므로 G2 닫히지 않음).
- `pnpm personabench demo` 단일 명령 (G3): example app 기동 → `run-config.checkout.json` 실행 → `report.html` 생성/오픈까지 ≤2분
- `pnpm personabench demo:crack` 두 번째 명령: agent-browser allowlist 확인 후 `run-config.crack.json` 실행. 데모 발표용. (≤4분 — 외부 네트워크 + 페이지 로드 시간 감안)

**D. baseline 게이트.**
`pnpm install && pnpm -r build && pnpm -r typecheck && pnpm -r lint && pnpm -r test` 전부 0 exit. 실패 시 그 iteration에서 고친 뒤 commit.

**E. 첫 commit + push.**
`chore(ralph): bootstrap monorepo + .ralph scaffolding`. 가이드 §12 트레일러 포함 (`Ralph-Task: TASK-000`, `Pattern: A` 등). commit 직후 `git push`로 `origin/develop`에 게시. push 실패 시 1회 재시도, 그래도 실패하면 다음 iteration에 catch-up. `git push --force` 절대 금지. `main`에는 절대 push 금지 (이번 빌드에서 loop가 소유하는 브랜치는 `develop` 하나뿐).

## 루프 본체

종료조건까지 반복:

```
Preflight → 다음 task 선택 → Pattern (§24.2 A/B/C/D) 결정 → 구현 → 검증
→ progress / learnings / status / spec-changes / stretch-queue 갱신
→ §12 트레일러 단일 commit
→ git push (origin/develop). 실패 시 1회 재시도, 그래도 실패하면 catch-up은 다음 iteration에서.
```

**Pattern 규칙.**

- Phase 1, 2, 3, 5, 6 마지막 task → Pattern C (`phase-tester` → `spec-reviewer` → 필요 시 `safety-auditor` / `dataset-validator` → 수정 → 재검증 → commit).
- 그 외 Phase 경계 (P0, P4, P7, P8, P9, P10, P11) → main thread 자체 검증으로 대체 가능 (시간 예산 active일 때만 Pattern C).
- 비자명 설계 결정 → Pattern B (Explore → Plan → 구현).
- runner / recorder 변경 시 그 iteration 안에서 `safety-auditor` 호출.
- personas / normalizer / source / DuckDB 변경 시 `dataset-validator` 호출.
- 그 외 → Pattern A.
- **sub-agent 호출 합계가 한 phase에서 4회를 넘으면** 그 phase는 main thread 자체 검증으로 마무리한다 (가이드 §24.5b).

**페이싱 규칙.**

- `active`   : 신규 기능 OK. 단 G1~G3 미통과면 신규 기능 금지, 게이트 복구 우선.
- `WARNING`  (≤30m): 새 Phase 시작 금지. 진행 중 Phase 마무리만.
- `CRITICAL` (≤10m): 신규 코드 금지. 통합 / 검증 / 데모 경로 / `report.html` / commit.
- `PASSED`   : 마지막 commit 후 즉시 중단. `.ralph/status.json`에 인계 메모 작성.

**Phase 우선순위 (시간 부족 시 위에서부터 사수).**

```
P0 부트스트랩 → P1 core schemas → P2 personas → P3 runner →
P5 analyzer → P6 CLI → P7 report.html → examples/ecommerce-checkout(P10 데모 타깃) →
P8 web app → P4 recorder full → P9 MCP → P11 packs → P10 추가 어댑터.
```

## 데모 무결성 게이트 G1–G4 (가이드 §17)

데모 코어가 끝났다고 판단하기 전에 넷 다 그린이어야 한다. 빨간 게이트가 있으면 그 다음 iteration은 수정 iteration이며, 어떤 신규 기능도 시작하지 않는다.

- **G1 — Friction surface lives.** `pnpm personabench run --config examples/run-config.checkout.json` 단일 실행이 ≥3 `FrictionSignal` + ≥1 high/critical `UXFinding` 생성.
- **G2 — Fix loop closes.** 생성된 `fix-prompts/F-001.md`를 `examples/ecommerce-checkout`에 적용 → rerun → `personabench compare runA runB`에서 해당 finding이 `resolved`로 잡힘.
- **G3 — One-command demo.** `pnpm personabench demo`가 example 기동 → run → `report.html` 자동 오픈까지 ≤2분 안에 완주.
- **G4 — Clone-and-install distribution.** 사내 보안상 npm publish 불가. `git clone <repo> && cd <repo> && pnpm install && pnpm -r build && pnpm personabench install` 4줄로 **다른 디렉터리·다른 Claude Code 세션·다른 Codex 세션**에서 `personabench`를 자유롭게 호출할 수 있어야 한다. 세부:
  - **G4-a (필수).** `packages/cli/package.json`에 `"bin": {"personabench": "dist/bin.js"}`. `pnpm personabench install`은 `pnpm -F @personabench/cli link --global`을 실행해 PATH에 `personabench`를 등록한다 (macOS 기본 global bin: `~/Library/pnpm`). 등록 후 임의 디렉터리에서 `personabench --version`이 0 exit으로 응답.
  - **G4-b (필수).** `personabench install`이 `~/.claude/settings.json`(또는 사용자 지정 경로)의 `mcpServers.personabench` 엔트리를 idempotent하게 추가. 값은 `{"command": "personabench", "args": ["mcp"]}`. 등록 직후 새 Claude Code 세션에서 `run_persona_ux_test` 도구가 보임. 설정 파일이 없으면 생성, 이미 있으면 다른 키 보존.
  - **G4-c (필수).** `personabench install`이 `plugins/claude-code/`를 `~/.claude/plugins/personabench/`로 심볼릭 링크 (있으면 갱신). `plugins/codex-skill/`는 사용자가 Codex를 쓸 때만 필요하므로 `--codex` 플래그로 옵트인.
  - **G4-d (필수).** `personabench uninstall`이 G4-a/b/c를 모두 되돌린다 (글로벌 링크 해제 + MCP 엔트리 제거 + 플러그인 심볼릭 링크 제거). 보안 환경이라 흔적 없는 제거가 가능해야 한다.
  - **G4-e (검증).** 검증 시나리오: 임시 디렉터리(`mktemp -d`) 만들고 `cd` 후 `personabench --version`, `personabench run --help`, `personabench mcp --help` 모두 0 exit. 이후 `personabench uninstall`로 정리되는 것까지 확인.

## 스트레치 큐 S1–S10 (가이드 §17, `active` + 게이트 그린일 때만)

위에서부터 순서대로. 건너뛰기 금지. 큐 상태는 `.ralph/stretch-queue.md`에 갱신.

```
S1  before/after compare 데모 (실제 fix 적용 → 두 run 비교)
S2  3~5 persona 동시 실행, 서로 다른 friction 패턴
S3  /runs/:id 라이브 폴링 + replay viewer (trace.zip 임베드)
S4  persona pack save/reuse (/personas → /persona-packs → /runs/new)
S5  MCP 서버 실 호출 smoke (다른 세션에서 run_persona_ux_test)
S6  LocalJsonPersonaSource 영문 1줄 fixture로 locale-agnostic 증명
S7  .github/workflows/ci.yml — clean clone 게이트 4종 통과
S8  README.md 퀵스타트 + report.html 스크린샷 1장
S9  report.html byte-stable 스냅샷 테스트
S10 rrweb / video 풀 통합 (Phase 4 deferred 항목)
```

## active일 때도 금지 (가이드 §17)

```
- 데모 코어와 무관한 refactor / 이름 바꾸기 / 폴더 재배치
- 새로운 패키지 / 도구 도입 (turbo, nx, changesets, husky, jest, eslint, prettier, mocha 등)
- hosted-track 기능 (auth, multi-tenant, pgvector, 분리된 API server, 빌링)
- 캐싱 / 병렬화 / 인덱싱 조기 최적화
- 새 LLM 모델 시험 (haiku-4-5 / sonnet-4-6 외)
- "혹시 모를 미래"용 추상화 / 인터페이스
- 테스트 없는 코드 (예외: docs와 example app의 의도적 결함 UI)
```

S10까지 다 끝났는데 시간이 남으면 `chore(ralph): stretch queue exhausted` 마커만 commit하고 idle.

## 데모 DoD (가능한 만큼 사수 — `pnpm personabench demo`로 한 번에 검증)

- pnpm 게이트 4종 (install / build / typecheck / lint / test) 통과
- `examples/ecommerce-checkout` (port 3100)에 대해 `pnpm personabench run --config examples/run-config.checkout.json` 성공
- `.personabench/runs/<id>/`에 `run.json`, `personas.json`, `events.ndjson`, `friction-signals.json`, `findings.json`, `interview.md`, `fix-prompts/F-001.md`, `artifacts/screenshots/`, `report.html` 존재
- 최소 1 finding이 evidence (`eventIds` + `screenshotPaths`) 포함
- 최소 1 fix-prompt 생성, G2를 통과해 compare에서 resolved 확인
- `pnpm personabench serve`로 웹앱 기동, 같은 흐름 재현 (시간 부족 시 dashboard + run progress까지만)
- **라이브 데모 시나리오**: `pnpm personabench demo:crack`이 `examples/run-config.crack.json`을 받아 `https://crack.wrtn.ai/` 에 대해 run을 1회 완주하고 `report.html`을 생성. 19세 페르소나가 SF/판타지 카테고리에 도달하기까지의 friction을 trace로 남긴다. 로그인·가입·결제·메시지 전송 시도는 모두 `safety_violation` 또는 `payment_blocked`로 즉시 차단되어야 한다.
- git history가 task 단위로 끊겨 있고 모든 commit에 §12 트레일러 존재
- 게이트 G1·G2·G3·G4 그린

지금 iteration 0(부트스트랩)부터 시작한다.
