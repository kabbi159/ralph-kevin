import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { type UXFinding, UXFindingSchema } from "@personabench/core";

// `personabench compare <runIdA> <runIdB>` → compare.html
// A finding from runA is "resolved" if no finding in runB shares its title.
// (Title is locale-stable because the analyzer's TITLE_BY_TYPE map is
// canonicalized per friction type.)

export type CompareCommandOpts = {
  runIdA: string;
  runIdB: string;
  runsRoot?: string;
};

export type CompareCommandResult = {
  resolvedFindings: UXFinding[];
  newFindings: UXFinding[];
  comparePath: string;
};

const loadFindings = (runDir: string): UXFinding[] => {
  const p = join(runDir, "findings.json");
  if (!existsSync(p)) {
    throw new Error(`compare: findings.json not found at ${p}`);
  }
  const arr = JSON.parse(readFileSync(p, "utf8")) as unknown[];
  return arr.map((f) => UXFindingSchema.parse(f));
};

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const compareCommand = (opts: CompareCommandOpts): CompareCommandResult => {
  const runsRoot = opts.runsRoot ?? resolve(".personabench", "runs");
  const dirA = join(runsRoot, opts.runIdA);
  const dirB = join(runsRoot, opts.runIdB);
  const a = loadFindings(dirA);
  const b = loadFindings(dirB);

  const titlesA = new Set(a.map((f) => f.title));
  const titlesB = new Set(b.map((f) => f.title));
  const resolvedFindings = a.filter((f) => !titlesB.has(f.title));
  const newFindings = b.filter((f) => !titlesA.has(f.title));

  const comparePath = join(dirB, `compare-${opts.runIdA}.html`);
  mkdirSync(dirname(comparePath), { recursive: true });
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8" /><title>Compare ${escapeHtml(opts.runIdA)} vs ${escapeHtml(opts.runIdB)}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:960px;margin:0 auto;padding:32px 24px;background:#fafafa;color:#111}
h1{font-size:24px}h2{margin-top:24px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;font-size:18px}
.f{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:8px}
.f.resolved{border-left:4px solid #16a34a}
.f.new{border-left:4px solid #b91c1c}
.sev{font-size:11px;font-weight:700;color:#fff;padding:2px 8px;border-radius:999px;background:#525252}
</style></head><body>
<h1>Compare</h1>
<p>${escapeHtml(opts.runIdA)} → ${escapeHtml(opts.runIdB)}</p>
<h2>Resolved (${resolvedFindings.length})</h2>
${resolvedFindings.map((f) => `<div class="f resolved"><span class="sev">${escapeHtml(f.severity)}</span> <b>${escapeHtml(f.title)}</b><br /><small>${escapeHtml(f.summary)}</small></div>`).join("") || "<p>None.</p>"}
<h2>New (${newFindings.length})</h2>
${newFindings.map((f) => `<div class="f new"><span class="sev">${escapeHtml(f.severity)}</span> <b>${escapeHtml(f.title)}</b><br /><small>${escapeHtml(f.summary)}</small></div>`).join("") || "<p>None.</p>"}
</body></html>`;
  writeFileSync(comparePath, html);

  return { resolvedFindings, newFindings, comparePath };
};
