import type {
  Interview,
  PersonaUXProfile,
  RunConfig,
  RunEvent,
  UXFinding,
} from "@personabench/core";

// Self-contained static HTML report. No external CDN, all CSS inlined,
// every artifact link relative to the run dir so the file portable. The
// web app (Phase 8) reuses the same React components on the SSR side.

export type RenderReportInput = {
  runId: string;
  config: RunConfig;
  persona: PersonaUXProfile;
  events: RunEvent[];
  findings: UXFinding[];
  interview: Interview;
  fixPromptPaths: string[];
  generatedAt: string;
};

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const sevColor: Record<UXFinding["severity"], string> = {
  critical: "#b91c1c",
  high: "#c2410c",
  medium: "#a16207",
  low: "#4d7c0f",
};

export const renderReportHtml = (input: RenderReportInput): string => {
  const { runId, config, persona, events, findings, interview, generatedAt } = input;
  const findingsHtml = findings
    .map(
      (f) => `
    <article class="finding" style="border-left:4px solid ${sevColor[f.severity]};">
      <header>
        <span class="sev sev-${f.severity}">${f.severity.toUpperCase()}</span>
        <h3>${escapeHtml(f.id)} · ${escapeHtml(f.title)}</h3>
      </header>
      <p>${escapeHtml(f.summary)}</p>
      <details>
        <summary>Diagnosis (confidence ${f.diagnosis.confidence.toFixed(2)})</summary>
        <p><b>User goal:</b> ${escapeHtml(f.diagnosis.userGoal)}</p>
        <p><b>Observed behavior:</b> ${escapeHtml(f.diagnosis.observedBehavior)}</p>
        <p><b>Likely cause:</b> ${escapeHtml(f.diagnosis.likelyCause)}</p>
      </details>
      <details>
        <summary>Recommendation</summary>
        <p>${escapeHtml(f.recommendation.uxChange)}</p>
        ${
          f.recommendation.implementationHint
            ? `<p><i>${escapeHtml(f.recommendation.implementationHint)}</i></p>`
            : ""
        }
        <ul>${f.recommendation.acceptanceCriteria.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
      </details>
      <details>
        <summary>Evidence (${f.evidence.eventIds.length} event${f.evidence.eventIds.length === 1 ? "" : "s"})</summary>
        <p>Event IDs: <code>${f.evidence.eventIds.map((v) => escapeHtml(v)).join(", ")}</code></p>
        ${
          f.evidence.screenshots && f.evidence.screenshots.length > 0
            ? `<div class="shots">${f.evidence.screenshots
                .map((s) => `<img src="${escapeHtml(s)}" alt="${escapeHtml(s)}" />`)
                .join("")}</div>`
            : ""
        }
      </details>
      <details>
        <summary>Coding-agent fix prompt</summary>
        <pre>${escapeHtml(f.codingAgentPrompt)}</pre>
      </details>
    </article>`,
    )
    .join("");

  const timelineHtml = events
    .map(
      (ev) => `
      <li class="ev">
        <span class="step">${ev.stepIndex}</span>
        <span class="ts">${new Date(ev.timestampMs).toISOString().slice(11, 19)}</span>
        <span class="action">${escapeHtml(ev.action?.type ?? "(observe)")}</span>
        <span class="reason">${escapeHtml(ev.action?.reason ?? "")}</span>
      </li>`,
    )
    .join("");

  const interviewHtml = interview.qaPairs
    .map(
      (qa) => `
      <li class="qa">
        <p class="q">${escapeHtml(qa.question)}</p>
        <p class="a">${escapeHtml(qa.answer)}</p>
        <p class="cite">cited events: ${qa.eventIds.map((id) => `<code>${escapeHtml(id)}</code>`).join(", ")}</p>
      </li>`,
    )
    .join("");

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>PersonaBench — ${escapeHtml(runId)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; margin: 0; background: #fafafa; color: #111; }
  main { max-width: 980px; margin: 0 auto; padding: 32px 24px 80px; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  h2 { font-size: 20px; margin: 32px 0 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
  h3 { font-size: 16px; margin: 0; }
  .meta { color: #555; font-size: 14px; margin-bottom: 32px; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
  .finding { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
  .finding header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .finding details { margin-top: 8px; }
  .finding pre { white-space: pre-wrap; font-size: 12px; background: #f4f4f5; padding: 8px; border-radius: 6px; max-height: 240px; overflow: auto; }
  .sev { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; color: #fff; }
  .sev-critical { background: ${sevColor.critical}; }
  .sev-high { background: ${sevColor.high}; }
  .sev-medium { background: ${sevColor.medium}; }
  .sev-low { background: ${sevColor.low}; }
  ul.timeline { list-style: none; padding: 0; margin: 0; }
  ul.timeline .ev { display: grid; grid-template-columns: 32px 80px 80px 1fr; align-items: baseline; padding: 4px 0; font-size: 13px; border-bottom: 1px solid #f4f4f5; }
  ul.timeline .ev .step { color: #71717a; }
  ul.timeline .ev .ts { color: #71717a; font-family: ui-monospace, SFMono-Regular, monospace; }
  ul.timeline .ev .action { font-weight: 600; }
  ul.timeline .ev .reason { color: #333; }
  ul.qa-list { list-style: none; padding: 0; }
  ul.qa-list .qa { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 8px; }
  ul.qa-list .qa .q { font-weight: 600; margin: 0 0 4px; }
  ul.qa-list .qa .a { margin: 0 0 6px; }
  ul.qa-list .qa .cite { color: #71717a; font-size: 12px; margin: 0; }
  .shots img { max-width: 240px; border: 1px solid #e5e7eb; border-radius: 6px; margin-right: 8px; vertical-align: top; }
  code { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px; }
  footer { margin-top: 40px; color: #71717a; font-size: 12px; }
</style>
</head>
<body>
<main>
  <h1>PersonaBench Run</h1>
  <p class="meta">Run <code>${escapeHtml(runId)}</code> · Generated <code>${escapeHtml(generatedAt)}</code></p>

  <h2>Run summary</h2>
  <section class="card">
    <p><b>Target:</b> <code>${escapeHtml(config.targetUrl)}</code></p>
    <p><b>Task:</b> ${escapeHtml(config.task)}</p>
    ${
      config.successCriteria?.length
        ? `<p><b>Success criteria:</b></p><ul>${config.successCriteria
            .map((c) => `<li>${escapeHtml(c)}</li>`)
            .join("")}</ul>`
        : ""
    }
    <p><b>Limits:</b> ${config.limits.maxDurationSec}s, ${config.limits.maxActions} actions</p>
    <p><b>Allowlist:</b> ${config.safety.allowedDomains.map((v) => escapeHtml(v)).join(", ")}</p>
  </section>

  <h2>Persona</h2>
  <section class="card">
    <p><b>${escapeHtml(persona.displayName)}</b> · <code>${escapeHtml(persona.personaId)}</code></p>
    <p><b>Source provenance:</b> ${escapeHtml(persona.sourceProvenance.provider)} / ${escapeHtml(persona.sourceProvenance.dataset)}${
      persona.sourceProvenance.rowId ? ` / row ${escapeHtml(persona.sourceProvenance.rowId)}` : ""
    }${persona.sourceProvenance.license ? ` (${escapeHtml(persona.sourceProvenance.license)})` : ""}</p>
    <p>${escapeHtml(persona.background)}</p>
    <details>
      <summary>UX behavior profile</summary>
      <p><b>Digital confidence:</b> ${escapeHtml(persona.uxBehavior.digitalConfidence)}</p>
      <p><b>Decision style:</b> ${escapeHtml(persona.uxBehavior.decisionStyle)}</p>
      <p><b>Likely concerns:</b></p>
      <ul>${persona.uxBehavior.likelyConcerns.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
      <p><b>Friction triggers:</b></p>
      <ul>${persona.uxBehavior.frictionTriggers.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
    </details>
  </section>

  <h2>Findings (${findings.length})</h2>
  ${findingsHtml || '<p class="meta">No findings — the persona completed the task without notable friction.</p>'}

  <h2>Timeline (${events.length} events)</h2>
  <section class="card">
    <ul class="timeline">${timelineHtml}</ul>
  </section>

  <h2>Interview</h2>
  <section class="card">
    <p><b>Summary:</b> ${escapeHtml(interview.summary)}</p>
    <ul class="qa-list">${interviewHtml}</ul>
  </section>

  <footer>
    <p>Generated by PersonaBench. Persona source: <b>${escapeHtml(persona.sourceProvenance.provider)}</b> / ${escapeHtml(persona.sourceProvenance.dataset)}. Synthetic personas are not a substitute for real user research.</p>
  </footer>
</main>
</body>
</html>`;
};
