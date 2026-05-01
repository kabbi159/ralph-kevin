import { ArrowLeft, Code2 } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "../../../components/ui";

export default function NewRunPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          대시보드로 돌아가기
        </Link>
        <h1 className="text-4xl font-semibold tracking-tight">새 UX 테스트</h1>
        <p className="mt-3 text-slate-400">
          현재 빌드에서는 테스트 실행을 CLI 또는 MCP 로 트리거합니다 — 웹앱은 결과 뷰입니다.
        </p>
        <Card className="mt-10 bg-slate-950 shadow-2xl shadow-black/30">
          <CardContent>
            <div className="mb-4 flex items-center gap-2 text-sm text-slate-400">
              <Code2 className="h-4 w-4" />
              terminal
            </div>
            <pre className="overflow-x-auto rounded-2xl bg-black/60 p-5 text-sm leading-7 text-slate-200">{`# 단일 페르소나 테스트
pnpm personabench run --config examples/run-config.checkout.json

# 다중 페르소나 변동 (4명, 다른 마찰 패턴)
pnpm personabench run --config examples/run-config.checkout.json --count 4

# 한 번에 G1 + G2 + compare 까지
pnpm personabench demo

# 라이브 모드 (실 agent-browser + Anthropic SDK)
pnpm personabench run --config examples/run-config.checkout.json --mode live`}</pre>
          </CardContent>
        </Card>
        <p className="mt-8 text-sm text-slate-400">
          실행이 완료되면{" "}
          <Link href="/" className="text-cyan-300 hover:underline">
            대시보드
          </Link>
          를 새로 고침하세요.
        </p>
      </div>
    </main>
  );
}
