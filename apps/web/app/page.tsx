import { ArrowRight, Bot, Code2, Database, Globe2, PlayCircle, Search, Video } from "lucide-react";
import Link from "next/link";
import { Button, Card, CardContent } from "../components/ui";
import { listRuns } from "../lib/runs";

const fadeUp = "transition-all duration-500 ease-out";

const workflow = [
  {
    icon: Search,
    title: "타깃 페르소나 찾기",
    body: "Nemotron-Personas 데이터셋을 국가·연령·지역·직업·행동 특성·제품 컨텍스트로 검색·필터링한다.",
  },
  {
    icon: Bot,
    title: "페르소나 에이전트 실행",
    body: "AI 페르소나가 실제 사용자처럼 제품을 사용한다 — 머뭇거림, 혼란, 되돌아가기, 이탈까지 그대로.",
  },
  {
    icon: Video,
    title: "리플레이 확인",
    body: "모든 테스트는 세션 리플레이, 액션 로그, 마찰 신호, 스크린샷, 근거 기반 사후 인터뷰를 남긴다.",
  },
  {
    icon: Code2,
    title: "코딩 에이전트로 수정",
    body: "각 UX 결함을 Claude Code, Codex, GitHub Issues, Linear, Jira 가 받을 수 있는 구현 작업으로 변환한다.",
  },
];

export const dynamic = "force-dynamic";

export default function HomePage() {
  const runs = listRuns().slice(0, 8);
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-x-0 top-[-300px] h-[800px] bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.18),transparent_60%)]"
        />
        <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6 text-sm text-slate-300">
          <div className="flex items-center gap-2 font-semibold text-white">
            <Database className="h-5 w-5 text-cyan-300" />
            PersonaBench
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <Link href="#workflow" className="hover:text-white">
              워크플로우
            </Link>
            <Link href="#runs" className="hover:text-white">
              최근 런
            </Link>
            <Link href="/personas" className="hover:text-white">
              페르소나
            </Link>
            <Link href="/persona-packs" className="hover:text-white">
              페르소나 팩
            </Link>
          </div>
          <Button href="/runs/new">새 테스트</Button>
        </nav>

        <section
          className={`relative mx-auto grid max-w-7xl items-center gap-12 px-6 pb-24 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:pb-32 ${fadeUp}`}
        >
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-cyan-100 backdrop-blur">
              <Database className="h-4 w-4" />
              데이터 기반 합성 페르소나
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
              추측하지 마. 페르소나 에이전트에게 물어봐.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300 md:text-xl">
              PersonaBench는 NVIDIA Nemotron-Personas 기반 합성 페르소나로 UX 테스트를 자동화하고,
              페르소나가 머뭇거리는 지점·이탈 지점을 기록해 매 UX 결함을 코딩 에이전트가 받을 수
              있는 수정 작업으로 변환합니다.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button href="/runs/new" className="">
                <span className="inline-flex items-center gap-2">
                  첫 UX 테스트 실행하기
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Button>
              <Button href="#runs" variant="outline">
                최근 런 보기
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap gap-2 text-sm text-slate-400">
              {["Korea", "Japan", "USA", "India", "Singapore", "Brazil", "France"].map((c) => (
                <span key={c} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            <div
              className="absolute -inset-6 rounded-[2.5rem] bg-cyan-400/10 blur-3xl"
              aria-hidden
            />
            <Card className="relative overflow-hidden bg-slate-900/80 shadow-2xl shadow-black/40 backdrop-blur">
              <CardContent className="p-0">
                <div className="border-b border-white/10 bg-white/[0.03] px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">실시간 UX 런</p>
                      <h3 className="font-semibold">체크아웃 흐름 · 한국 페르소나 팩</h3>
                    </div>
                    <div className="flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1 text-sm text-emerald-200">
                      <PlayCircle className="h-4 w-4" />
                      Running
                    </div>
                  </div>
                </div>
                <div className="grid gap-0 md:grid-cols-[1.2fr_0.8fr]">
                  <div className="border-b border-white/10 p-5 md:border-b-0 md:border-r">
                    <div className="aspect-video rounded-2xl border border-white/10 bg-slate-950 p-4">
                      <div className="mb-4 flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-red-400" />
                        <div className="h-3 w-3 rounded-full bg-yellow-400" />
                        <div className="h-3 w-3 rounded-full bg-green-400" />
                      </div>
                      <div className="rounded-xl bg-white p-4 text-slate-950">
                        <div className="mb-4 h-4 w-28 rounded bg-slate-200" />
                        <div className="space-y-3">
                          <div className="h-12 rounded-xl bg-slate-100" />
                          <div className="h-12 rounded-xl bg-slate-100" />
                          <div className="grid grid-cols-2 gap-3">
                            <div className="h-16 rounded-xl bg-slate-100" />
                            <div className="h-16 rounded-xl bg-slate-100" />
                          </div>
                          <div className="h-12 rounded-xl bg-slate-950" />
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
                      <span>리플레이 시각</span>
                      <span>00:36 / 03:00</span>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="mb-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">페르소나</p>
                      <h4 className="mt-2 font-semibold">19세 디자인 전공 학생</h4>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        서울 강남구 · 모바일 결제에 익숙 · 가격 변동에 민감
                      </p>
                    </div>
                    <div className="space-y-3">
                      <TimelineItem time="00:04" label="배송 정보 토글 클릭" />
                      <TimelineItem time="00:07" label="총액 영역에서 13초 멈칫" active />
                      <TimelineItem time="00:36" label="결제 확정 무응답 클릭 3회" />
                    </div>
                    <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-sm font-medium text-white">인터뷰 발췌</p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        "이게 진짜 결제될 금액인지 확신이 안 든다. 환불 정책도 어디 있는지
                        모르겠어서 결제 못 할 것 같다."
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>

      <section id="workflow" className="mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
            워크플로우
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
            AI 시대에 출하하는 팀을 위한 UX 리서치 루프.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            개발자, PM, 디자이너, UX 리서처 모두에게 같은 증거를 제공합니다 — 페르소나가 무엇을
            시도했는지, 어디서 헤매었는지, 왜 이탈했는지, 그리고 무엇을 고쳐야 하는지.
          </p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {workflow.map((item) => (
            <Card key={item.title} className="">
              <CardContent>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{item.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="runs" className="border-y border-white/10 bg-white/[0.03]">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="mb-10 flex items-end justify-between gap-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
                최근 런
              </p>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
                파일 시스템에서 직접 읽는 라이브 런 목록
              </h2>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
                CLI 또는 MCP 로 실행한 모든 런이 같은{" "}
                <code className="rounded bg-white/10 px-2 py-1 font-mono text-sm text-cyan-200">
                  .personabench/runs/
                </code>{" "}
                디렉터리에서 노출됩니다.
              </p>
            </div>
            <Button href="/runs/new" variant="outline">
              새 테스트 실행
            </Button>
          </div>
          {runs.length === 0 ? (
            <Card>
              <CardContent>
                <p className="text-slate-400">
                  아직 런이 없습니다. 터미널에서{" "}
                  <code className="rounded bg-white/10 px-2 py-1 font-mono text-sm text-cyan-200">
                    pnpm personabench demo
                  </code>{" "}
                  를 실행한 뒤 페이지를 새로 고침하세요.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {runs.map((run) => (
                <Link
                  key={run.id}
                  href={`/runs/${run.id}`}
                  className="block transition hover:translate-y-[-2px]"
                >
                  <Card>
                    <CardContent>
                      <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
                        <code className="font-mono text-cyan-200">{run.id.slice(0, 18)}…</code>
                        <ScenarioBadge scenario={run.scenario} />
                      </div>
                      {run.label ? (
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-cyan-300">
                          {run.label}
                        </p>
                      ) : null}
                      <h3 className="text-lg font-semibold">{run.task || "(no task)"}</h3>
                      <p className="mt-2 truncate font-mono text-xs text-slate-400">
                        {run.targetUrl}
                      </p>
                      <div className="mt-5 grid grid-cols-3 gap-3 text-center text-sm">
                        <Stat label="events" value={run.counts.events} />
                        <Stat label="signals" value={run.counts.frictionSignals} />
                        <Stat label="findings" value={run.counts.findings} />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
              데이터 기반
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
              프롬프트 vibes 가 아닌, 데이터셋 기반 에이전트
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              국가별 Nemotron-Personas 데이터셋을 검색하고, 메타데이터로 좁힌 뒤, 선택된 레코드를 UX
              행동 프로파일로 컴파일해 테스트합니다.
            </p>
            <div className="mt-8 grid gap-3 text-sm text-slate-300">
              <FeatureLine icon={Globe2} text="국가별 페르소나 컬렉션 — 글로벌 제품 테스트" />
              <FeatureLine icon={Database} text="연령·지역·직업·교육·가족형태 등 메타데이터 필터" />
              <FeatureLine
                icon={Code2}
                text="모든 리포트에 페르소나 출처(provider/dataset/rowId/license) 기재"
              />
            </div>
          </div>
          <Card className="bg-slate-950 shadow-2xl shadow-black/30">
            <CardContent>
              <div className="mb-4 flex items-center gap-2 text-sm text-slate-400">
                <Code2 className="h-4 w-4" />
                terminal
              </div>
              <pre className="overflow-x-auto rounded-2xl bg-black/60 p-5 text-sm leading-7 text-slate-200">{`pnpm personabench run \\
  --config examples/run-config.checkout.json \\
  --count 4

pnpm personabench demo
pnpm personabench mcp        # MCP stdio 서버
pnpm personabench install    # 글로벌 등록`}</pre>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-12 text-sm text-slate-500">
          PersonaBench. 합성 페르소나는 실제 사용자 리서치를 대체하지 않습니다 — 사용 시 출처
          (NVIDIA Nemotron-Personas) 표기 의무.
        </div>
      </footer>
    </main>
  );
}

function TimelineItem({
  time,
  label,
  active = false,
}: { time: string; label: string; active?: boolean }) {
  return (
    <div
      className={`flex gap-3 rounded-2xl border p-3 ${
        active ? "border-cyan-300/30 bg-cyan-300/10" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <span className="font-mono text-xs text-cyan-200">{time}</span>
      <span className="text-sm text-slate-300">{label}</span>
    </div>
  );
}

function FeatureLine({ icon: Icon, text }: { icon: typeof Globe2; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <Icon className="h-5 w-5 text-cyan-200" />
      <span>{text}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <div className="text-2xl font-semibold text-cyan-200">{value}</div>
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
    </div>
  );
}

function ScenarioBadge({ scenario }: { scenario?: string }) {
  if (!scenario) return <span className="text-slate-500">—</span>;
  const styles: Record<string, string> = {
    "crack-live": "border-rose-400/30 bg-rose-400/15 text-rose-200",
    "local-checkout": "border-cyan-300/30 bg-cyan-300/15 text-cyan-200",
    "external-live": "border-amber-400/30 bg-amber-400/15 text-amber-200",
    custom: "border-white/15 bg-white/10 text-slate-200",
  };
  const labels: Record<string, string> = {
    "crack-live": "🔥 Crack Live",
    "local-checkout": "Local Checkout",
    "external-live": "External Live",
    custom: "Custom",
  };
  const cls = styles[scenario] ?? styles.custom;
  const label = labels[scenario] ?? scenario;
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
}
