import { ArrowLeft, Eye, FileText, PlayCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, SeverityBadge } from "../../../components/ui";
import { readRun } from "../../../lib/runs";

export const dynamic = "force-dynamic";

type FindingShape = {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  summary: string;
  diagnosis: {
    observedBehavior: string;
    likelyCause: string;
    confidence: number;
    userGoal: string;
  };
  recommendation: { uxChange: string; acceptanceCriteria: string[]; implementationHint?: string };
  evidence: {
    eventIds: string[];
    timestamps: string[];
    screenshots?: string[];
    frictionSignalIds: string[];
  };
  codingAgentPrompt: string;
};

type EventShape = {
  id: string;
  stepIndex: number;
  timestampMs: number;
  action?: {
    type: string;
    reason: string;
    selector?: string;
    direction?: string;
    outcome?: string;
  };
  thoughtSummary?: string;
};

type InterviewShape = {
  summary: string;
  qaPairs: Array<{ question: string; answer: string; eventIds: string[] }>;
};

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const data = readRun(runId);
  if (!data) notFound();
  const { summary, findings: rawFindings, interview, events: rawEvents, personas } = data;
  const findings = rawFindings as FindingShape[];
  const events = rawEvents as EventShape[];
  const iv = interview as InterviewShape | null;
  const persona =
    (personas[0] as {
      id?: string;
      demographics?: { age?: number; occupation?: string };
      locale?: { province?: string };
      narratives?: { persona?: string };
    }) ?? {};

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          대시보드로 돌아가기
        </Link>

        <header className="mb-10">
          <div className="mb-3 flex items-center gap-3 text-xs text-slate-400">
            <code className="rounded bg-white/10 px-2 py-1 font-mono text-cyan-200">{runId}</code>
            <span>·</span>
            <span>{summary.status}</span>
            <span>·</span>
            <span>{summary.createdAt}</span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{summary.task}</h1>
          <p className="mt-3 text-slate-400">
            <span className="font-mono text-cyan-200">{summary.targetUrl}</span>
          </p>
          <div className="mt-6 flex gap-3">
            <Stat label="이벤트" value={summary.counts.events} />
            <Stat label="마찰 신호" value={summary.counts.frictionSignals} />
            <Stat label="발견" value={summary.counts.findings} accent />
            <a
              href={summary.reportPath}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <FileText className="h-4 w-4" />
              report.html 열기
            </a>
          </div>
        </header>

        <section className="mb-10">
          <Card className="bg-cyan-300/5 border-cyan-300/20">
            <CardContent>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
                페르소나
              </p>
              <h2 className="text-2xl font-semibold">
                {persona.demographics?.age ?? "?"}세 · {persona.demographics?.occupation ?? "?"}
                {persona.locale?.province ? ` · ${persona.locale.province}` : ""}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {persona.narratives?.persona ?? ""}
              </p>
              <p className="mt-2 font-mono text-xs text-slate-500">{persona.id}</p>
            </CardContent>
          </Card>
        </section>

        <section className="mb-10">
          <h2 className="mb-5 text-2xl font-semibold tracking-tight">발견 ({findings.length})</h2>
          <div className="space-y-4">
            {findings.length === 0 ? (
              <Card>
                <CardContent>
                  <p className="text-slate-400">이 런에서는 마찰이 거의 발견되지 않았습니다.</p>
                </CardContent>
              </Card>
            ) : (
              findings.map((f) => (
                <Card key={f.id}>
                  <CardContent>
                    <div className="mb-4 flex items-center gap-3">
                      <SeverityBadge severity={f.severity} />
                      <span className="text-xs text-slate-400">{f.id}</span>
                      <span className="ml-auto text-xs text-slate-500">
                        confidence {f.diagnosis.confidence.toFixed(2)}
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold">{f.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{f.summary}</p>
                    <div className="mt-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-sm text-slate-300">
                      <Eye className="h-4 w-4 text-cyan-200" />
                      이벤트 {f.evidence.eventIds.length} · 신호{" "}
                      {f.evidence.frictionSignalIds.length}
                      {f.evidence.screenshots?.length
                        ? ` · 스크린샷 ${f.evidence.screenshots.length}`
                        : ""}
                    </div>
                    {f.evidence.screenshots?.length ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {f.evidence.screenshots.map((rel) => (
                          <a
                            key={rel}
                            href={`/api/runs/${runId}/artifacts/${rel}`}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-xl border border-white/10 bg-slate-950 transition hover:border-cyan-300/30"
                          >
                            <img
                              src={`/api/runs/${runId}/artifacts/${rel}`}
                              alt={rel}
                              className="h-32 w-full object-cover object-top"
                            />
                            <p className="px-2 py-1 font-mono text-[10px] text-slate-500">{rel}</p>
                          </a>
                        ))}
                      </div>
                    ) : null}
                    <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-200">
                        진단 + 권고
                      </summary>
                      <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                        <p>
                          <span className="font-semibold text-white">목표:</span>{" "}
                          {f.diagnosis.userGoal}
                        </p>
                        <p>
                          <span className="font-semibold text-white">관찰:</span>{" "}
                          {f.diagnosis.observedBehavior}
                        </p>
                        <p>
                          <span className="font-semibold text-white">추정 원인:</span>{" "}
                          {f.diagnosis.likelyCause}
                        </p>
                        <p>
                          <span className="font-semibold text-white">권고:</span>{" "}
                          {f.recommendation.uxChange}
                        </p>
                        <ul className="ml-4 list-disc space-y-1 text-slate-400">
                          {f.recommendation.acceptanceCriteria.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    </details>
                    <details className="mt-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-200">
                        코딩 에이전트 프롬프트
                      </summary>
                      <pre className="mt-3 overflow-x-auto rounded-xl bg-black/40 p-4 text-xs leading-6 text-slate-300">
                        {f.codingAgentPrompt}
                      </pre>
                    </details>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </section>

        <section className="mb-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <h2 className="mb-5 text-2xl font-semibold tracking-tight">
              타임라인 ({events.length})
            </h2>
            <Card>
              <CardContent>
                <ol className="space-y-2 text-sm">
                  {events.slice(0, 25).map((ev) => (
                    <li
                      key={ev.id}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2"
                    >
                      <span className="w-8 text-right font-mono text-xs text-slate-500">
                        {ev.stepIndex}
                      </span>
                      <span className="font-mono text-xs text-cyan-200">
                        {new Date(ev.timestampMs).toISOString().slice(11, 19)}
                      </span>
                      <span className="text-slate-200">{ev.action?.type ?? "(observe)"}</span>
                      <span className="text-slate-400">{ev.action?.reason ?? ""}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>
          <div>
            <h2 className="mb-5 text-2xl font-semibold tracking-tight">
              <span className="inline-flex items-center gap-2">
                <PlayCircle className="h-5 w-5 text-cyan-300" />
                인터뷰
              </span>
            </h2>
            {iv ? (
              <Card>
                <CardContent>
                  <p className="mb-5 text-sm italic leading-6 text-slate-300">{iv.summary}</p>
                  <ul className="space-y-3">
                    {iv.qaPairs.map((qa, i) => (
                      <li
                        key={`${qa.question}-${i}`}
                        className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                      >
                        <p className="text-sm font-semibold text-white">{qa.question}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{qa.answer}</p>
                        <p className="mt-2 font-mono text-xs text-slate-500">
                          cited: {qa.eventIds.join(", ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent>
                  <p className="text-slate-400">인터뷰 아티팩트가 없습니다.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        accent ? "border-cyan-300/30 bg-cyan-300/10" : "border-white/10 bg-white/5"
      }`}
    >
      <div className={`text-2xl font-semibold ${accent ? "text-cyan-200" : "text-white"}`}>
        {value}
      </div>
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
    </div>
  );
}
