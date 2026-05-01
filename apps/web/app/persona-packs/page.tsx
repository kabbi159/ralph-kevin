import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { ArrowLeft, Database, Globe2, Users } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "../../components/ui";

export const dynamic = "force-dynamic";

type PackShape = {
  id: string;
  name: string;
  description?: string;
  source: { datasets: string[] };
  personas: Array<{
    id: string;
    locale: { country?: string; province?: string };
    demographics: { age?: number; sex?: string; occupation?: string };
    narratives: { persona?: string };
  }>;
  coverage: {
    size: number;
    countries: string[];
    ageDistribution?: Record<string, number>;
    occupationDistribution?: Record<string, number>;
  };
};

const PACKS_ROOT = resolve(process.cwd(), "..", "..", ".personabench", "persona-packs");

const listPacks = (): PackShape[] => {
  if (!existsSync(PACKS_ROOT)) return [];
  return readdirSync(PACKS_ROOT)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(PACKS_ROOT, f), "utf8")) as PackShape;
      } catch {
        return null;
      }
    })
    .filter((p): p is PackShape => p !== null);
};

export default function PersonaPacksPage() {
  const packs = listPacks();

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
        <div className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Persona Packs
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
            저장된 페르소나 팩
          </h1>
          <p className="mt-3 text-slate-400">
            검색 쿼리 + 매칭된 페르소나 레코드를 묶어 재사용. CLI 로 만들고 웹에서 확인합니다.
          </p>
          <pre className="mt-6 overflow-x-auto rounded-2xl bg-black/60 p-5 text-sm leading-7 text-slate-200">{`pnpm personabench packs create \\
  --id <pack-id> \\
  --name "Korean Checkout Risk Pack" \\
  --age-min 40 --age-max 65

pnpm personabench packs list
pnpm personabench packs show <pack-id>`}</pre>
        </div>

        {packs.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-slate-400">아직 저장된 팩이 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {packs.map((pack) => (
              <Card key={pack.id}>
                <CardContent>
                  <p className="mb-1 font-mono text-xs text-slate-500">{pack.id}</p>
                  <h3 className="text-xl font-semibold">{pack.name}</h3>
                  {pack.description ? (
                    <p className="mt-2 text-sm text-slate-400">{pack.description}</p>
                  ) : null}
                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Users className="h-4 w-4 text-cyan-300" />
                        페르소나
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-cyan-200">
                        {pack.coverage.size}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Globe2 className="h-4 w-4 text-cyan-300" />
                        국가
                      </div>
                      <div className="mt-1 text-sm text-slate-200">
                        {pack.coverage.countries.join(", ") || "—"}
                      </div>
                    </div>
                  </div>
                  <details className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-200">
                      포함 페르소나
                    </summary>
                    <ul className="mt-3 space-y-2 text-sm">
                      {pack.personas.map((p) => (
                        <li
                          key={p.id}
                          className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
                        >
                          <p className="font-mono text-xs text-slate-500">{p.id}</p>
                          <p className="mt-1 text-slate-200">
                            {p.demographics.age ?? "?"}세 · {p.demographics.occupation ?? "?"} ·{" "}
                            {p.locale.province ?? p.locale.country ?? "?"}
                          </p>
                          {p.narratives.persona ? (
                            <p className="mt-1 text-xs leading-5 text-slate-400">
                              {p.narratives.persona}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </details>
                  <p className="mt-4 inline-flex items-center gap-2 text-xs text-slate-500">
                    <Database className="h-3 w-3" />
                    {pack.source.datasets.join(", ")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
