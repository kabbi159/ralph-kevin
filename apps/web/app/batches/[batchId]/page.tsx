import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { ArrowLeft, FileText, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, SeverityBadge } from "../../../components/ui";

export const dynamic = "force-dynamic";

const RUNS_ROOT = resolve(process.cwd(), "..", "..", ".personabench", "runs");

type RunInBatch = {
  runId: string;
  personaIndex: number;
  personaId: string;
  personaLabel: string;
  task: string;
  signals: number;
  findings: Array<{
    id: string;
    severity: "critical" | "high" | "medium" | "low";
    title: string;
    summary: string;
  }>;
};

const collectBatch = (batchId: string): RunInBatch[] => {
  if (!existsSync(RUNS_ROOT)) return [];
  const out: RunInBatch[] = [];
  for (const id of readdirSync(RUNS_ROOT)) {
    const dir = join(RUNS_ROOT, id);
    const batchPath = join(dir, "batch.json");
    if (!existsSync(batchPath)) continue;
    try {
      const tag = JSON.parse(readFileSync(batchPath, "utf8"));
      if (tag.batchId !== batchId) continue;
      const run = JSON.parse(readFileSync(join(dir, "run.json"), "utf8"));
      const findings = existsSync(join(dir, "findings.json"))
        ? (JSON.parse(readFileSync(join(dir, "findings.json"), "utf8")) as Array<{
            id: string;
            severity: "critical" | "high" | "medium" | "low";
            title: string;
            summary: string;
          }>)
        : [];
      const signals = existsSync(join(dir, "friction-signals.json"))
        ? (JSON.parse(readFileSync(join(dir, "friction-signals.json"), "utf8")) as unknown[]).length
        : 0;
      const personaJson = existsSync(join(dir, "personas.json"))
        ? JSON.parse(readFileSync(join(dir, "personas.json"), "utf8"))
        : [];
      const persona = personaJson[0] ?? {};
      out.push({
        runId: id,
        personaIndex: tag.personaIndex ?? 0,
        personaId: persona.id ?? "?",
        personaLabel: `${persona.demographics?.age ?? "?"}세 · ${persona.demographics?.occupation ?? "?"} · ${persona.locale?.province ?? "?"}`,
        task: run.config?.task ?? "",
        signals,
        findings,
      });
    } catch {
      // skip malformed batch entry
    }
  }
  return out.sort((a, b) => a.personaIndex - b.personaIndex);
};

const aggregateInsights = (runs: RunInBatch[]) => {
  const titleHits = new Map<string, { count: number; severity: string; sample: string }>();
  for (const run of runs) {
    for (const f of run.findings) {
      const key = f.title;
      const cur = titleHits.get(key);
      if (cur) {
        cur.count += 1;
      } else {
        titleHits.set(key, { count: 1, severity: f.severity, sample: f.summary });
      }
    }
  }
  return Array.from(titleHits.entries())
    .map(([title, v]) => ({ title, ...v }))
    .sort((a, b) => b.count - a.count);
};

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const runs = collectBatch(batchId);
  if (runs.length === 0) notFound();
  const insights = aggregateInsights(runs);
  const totalFindings = runs.reduce((acc, r) => acc + r.findings.length, 0);
  const totalSignals = runs.reduce((acc, r) => acc + r.signals, 0);

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
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Multi-persona Batch
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
            {runs.length}명 페르소나 동시 테스트
          </h1>
          <p className="mt-3 font-mono text-xs text-slate-500">batch: {batchId}</p>
          <div className="mt-6 flex gap-3">
            <Stat label="페르소나" value={runs.length} />
            <Stat label="마찰 신호 합계" value={totalSignals} />
            <Stat label="발견 합계" value={totalFindings} accent />
          </div>
        </header>

        <section className="mb-10">
          <h2 className="mb-5 text-2xl font-semibold tracking-tight">
            <span className="inline-flex items-center gap-2">
              <Users className="h-5 w-5 text-cyan-300" />
              페르소나별 결과
            </span>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {runs.map((run) => (
              <Link
                key={run.runId}
                href={`/runs/${run.runId}`}
                className="block transition hover:translate-y-[-2px]"
              >
                <Card>
                  <CardContent>
                    <p className="mb-1 font-mono text-xs text-slate-500">
                      Persona #{run.personaIndex + 1}
                    </p>
                    <h3 className="text-lg font-semibold">{run.personaLabel}</h3>
                    <p className="mt-2 font-mono text-[10px] text-slate-500">{run.personaId}</p>
                    <div className="mt-4 flex flex-wrap gap-1">
                      {run.findings.slice(0, 6).map((f) => (
                        <SeverityBadge key={f.id} severity={f.severity} />
                      ))}
                      {run.findings.length === 0 ? (
                        <span className="text-xs text-slate-500">발견 없음</span>
                      ) : null}
                    </div>
                    <div className="mt-4 text-sm text-slate-400">
                      마찰 {run.signals} · 발견 {run.findings.length}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="mb-5 text-2xl font-semibold tracking-tight">
            <span className="inline-flex items-center gap-2">
              <FileText className="h-5 w-5 text-cyan-300" />
              교차 페르소나 인사이트
            </span>
          </h2>
          <p className="mb-5 text-sm leading-6 text-slate-400">
            여러 페르소나가 같은 발견을 공유할수록 우선순위가 높아집니다. 한 페르소나에서만
            보이는 발견은 personality fit 이슈일 수 있고, 다수가 공유하는 발견은 구조적 결함입니다.
          </p>
          {insights.length === 0 ? (
            <Card>
              <CardContent>
                <p className="text-slate-400">발견이 없습니다.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {insights.map((ins) => (
                <Card key={ins.title}>
                  <CardContent>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <SeverityBadge severity={ins.severity as "critical" | "high" | "medium" | "low"} />
                        <h3 className="mt-3 text-lg font-semibold">{ins.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{ins.sample}</p>
                      </div>
                      <div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-center">
                        <div className="text-3xl font-semibold text-cyan-200">{ins.count}</div>
                        <div className="text-xs uppercase tracking-wider text-slate-400">
                          {ins.count === runs.length ? "전원" : `${runs.length}명 중`}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
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
