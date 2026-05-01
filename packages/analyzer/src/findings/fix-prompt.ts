import type { FrictionSignalType, PersonaUXProfile, UXFinding } from "@personabench/core";

// Renders docs/04 §Coding-agent fix prompt structure for one finding.
// The output is plain Markdown so it can be pasted into a PR comment, a
// Linear issue, or fed to a Claude / Codex coding session as-is.
//
// Korean is the default language because the verified persona dataset is
// nvidia/Nemotron-Personas-Korea. Pass `lang: "en"` when the persona's
// source dataset is non-Korea or when the consumer prefers English.

type Lang = "ko" | "en";

const SUGGESTED_FILES_BY_TYPE: Partial<Record<FrictionSignalType, string>> = {
  price_uncertainty:
    "examples/ecommerce-checkout/app/checkout/page.tsx — totalDisplay 와 배송 토글 영역.",
  cta_not_found:
    "examples/ecommerce-checkout/app/checkout/page.tsx — '결제 확정' 비활성 버튼 블록.",
  dead_click:
    "examples/ecommerce-checkout/app/checkout/page.tsx — '결제 확정' 버튼의 disabled 조건 (인라인 사유 미표시).",
  trust_uncertainty: "결제 단계 근처의 환불/취소 정책 링크.",
};

const STRINGS_KO = {
  title: (t: string) => `# UX 수정 작업: ${t}`,
  context: "## 컨텍스트",
  productFlow: (t: string) => `- 제품 흐름: ${t}`,
  url: (u: string) => `- URL: ${u}`,
  persona: (n: string, id: string) => `- 페르소나: ${n} (${id})`,
  source: (p: string, d: string) => `  - 출처: ${p} / ${d}`,
  observed: "## 관찰된 행동",
  evidence: "## 증거",
  ts: (s: string) => `- 타임스탬프: ${s}`,
  events: (s: string) => `- 이벤트: ${s}`,
  shots: (s: string) => `- 스크린샷: ${s}`,
  replay: (p: string) => `- 리플레이: ${p}`,
  cause: "## 추정 원인",
  fix: "## 필요한 수정",
  hint: (s: string) => `구현 힌트: ${s}`,
  files: (s: string) => `예상 수정 파일: ${s}`,
  acceptance: "## 수용 기준",
  constraints: "## 제약 사항",
  c1: "- 작업 범위는 작게 유지하라.",
  c2: "- 관련 없는 리디자인을 도입하지 말라.",
  c3: "- 비즈니스 로직은 꼭 필요한 경우에만 수정하라.",
  c4: "- 수정 후 PersonaBench 를 다시 실행하고 compare 뷰에서 해당 finding 이 `resolved` 로 이동하는지 검증하라.",
};

const STRINGS_EN = {
  title: (t: string) => `# UX Fix Task: ${t}`,
  context: "## Context",
  productFlow: (t: string) => `- Product flow: ${t}`,
  url: (u: string) => `- URL: ${u}`,
  persona: (n: string, id: string) => `- Persona: ${n} (${id})`,
  source: (p: string, d: string) => `  - Source: ${p} / ${d}`,
  observed: "## Observed behavior",
  evidence: "## Evidence",
  ts: (s: string) => `- Timestamps: ${s}`,
  events: (s: string) => `- Events: ${s}`,
  shots: (s: string) => `- Screenshots: ${s}`,
  replay: (p: string) => `- Replay: ${p}`,
  cause: "## Likely cause",
  fix: "## Required fix",
  hint: (s: string) => `Implementation hint: ${s}`,
  files: (s: string) => `Likely files: ${s}`,
  acceptance: "## Acceptance criteria",
  constraints: "## Constraints",
  c1: "- Keep scope small.",
  c2: "- Do not introduce unrelated redesigns.",
  c3: "- Do not change business logic unless necessary.",
  c4: "- Rerun PersonaBench after the fix and verify the finding moves to `resolved` in the compare view.",
};

const stringsFor = (lang: Lang) => (lang === "en" ? STRINGS_EN : STRINGS_KO);

export type FixPromptInput = {
  finding: UXFinding;
  persona: PersonaUXProfile;
  targetUrl: string;
  task: string;
  signalTypes: FrictionSignalType[];
  lang?: Lang;
};

export const renderFixPrompt = (input: FixPromptInput): string => {
  const { finding, persona, targetUrl, task, signalTypes } = input;
  const lang: Lang = input.lang ?? (persona.sourceProvenance.dataset.includes("USA") ? "en" : "ko");
  const s = stringsFor(lang);
  const lines: string[] = [];
  lines.push(s.title(finding.title));
  lines.push("");
  lines.push(s.context);
  lines.push(s.productFlow(task));
  lines.push(s.url(targetUrl));
  lines.push(s.persona(persona.displayName, persona.personaId));
  lines.push(s.source(persona.sourceProvenance.provider, persona.sourceProvenance.dataset));
  lines.push("");
  lines.push(s.observed);
  lines.push(finding.diagnosis.observedBehavior);
  lines.push("");
  lines.push(s.evidence);
  if (finding.evidence.timestamps.length) {
    lines.push(s.ts(finding.evidence.timestamps.join(", ")));
  }
  lines.push(s.events(finding.evidence.eventIds.join(", ")));
  if (finding.evidence.screenshots?.length) {
    lines.push(s.shots(finding.evidence.screenshots.join(", ")));
  }
  if (finding.evidence.replayPath) lines.push(s.replay(finding.evidence.replayPath));
  lines.push("");
  lines.push(s.cause);
  lines.push(finding.diagnosis.likelyCause);
  lines.push("");
  lines.push(s.fix);
  lines.push(finding.recommendation.uxChange);
  if (finding.recommendation.implementationHint) {
    lines.push("");
    lines.push(s.hint(finding.recommendation.implementationHint));
  }
  for (const t of signalTypes) {
    const hint = SUGGESTED_FILES_BY_TYPE[t];
    if (hint) {
      lines.push(s.files(hint));
      break;
    }
  }
  lines.push("");
  lines.push(s.acceptance);
  for (const c of finding.recommendation.acceptanceCriteria) lines.push(`- ${c}`);
  lines.push("");
  lines.push(s.constraints);
  lines.push(s.c1);
  lines.push(s.c2);
  lines.push(s.c3);
  lines.push(s.c4);
  return lines.join("\n");
};
