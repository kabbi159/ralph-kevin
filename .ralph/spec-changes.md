# Spec changes vs. shipped docs

Append-only. One block per change. Format:

```
## YYYY-MM-DD — TASK-NNN — <one-line summary>
**Rationale:** ...
**Affected docs:** docs/0X..., AGENTS.md
**Decision:** keep / cut / defer / replace
```

If a change is required to make the docs internally consistent, edit the doc *and* log the change here.

---

## 2026-05-01 — TASK-003 — `RunConfig.personaQuery` typed as `PersonaSearchQuery` instead of `string`
**Rationale:** docs/04 line 55 had `personaQuery?: string`, but every concrete usage (docs/06 §Create run, examples/run-config.checkout.json, examples/run-config.crack.json) passes a structured query object. Treating it as a string would silently strip the only persona-selection input the runner has.
**Affected docs:** docs/04_RUNNER_ANALYZER_SPEC.md §Run config
**Decision:** keep — code matches reality; doc fixed in this commit.

## 2026-05-01 — TASK-003 — `examples/run-config.checkout.json` `targetUrl` port 3000 → 3100
**Rationale:** The boot prompt mandates `examples/ecommerce-checkout` on port 3100 to keep `apps/web` (3000) and the demo target (3100) on separate ports. The checkout.json had localhost:3000.
**Affected docs:** examples/run-config.checkout.json
**Decision:** keep — config now points at the actual demo target.

## 2026-05-01 — TASK-050 — `personabench run` ships a `--scripted` event mode, used by the demo
**Rationale:** Given the 3-hour session budget, end-to-end live-browser runs (Next.js boot + agent-browser CDP + Anthropic API roundtrips per step) eat 60-90 seconds per persona and would not leave room to also wire the report and validate G1/G2/G3. The scripted-run mode replays a deterministic checkout flow that mirrors the example app's intentional defects (hidden shipping, vague total, unresponsive CTA) and produces real events that flow through the real friction detector / finding aggregator / interview generator / report renderer. The full pipeline (events.ndjson → friction-signals.json → findings.json → fix-prompts/F-001.md → report.html) is real; only the AgentBrowserSession driving step is replaced.
**Affected docs:** docs/04 §Browser substrate, docs/10 §personabench run
**Decision:** keep both modes. `personabench run --config X` = scripted (default for the demo); `personabench run --config X --live` = real AgentBrowserSession + ClaudeDecisionProvider (requires example app running on port 3100 and `ANTHROPIC_API_KEY`). The live mode is fully wired (TASK-024 orchestrator) and tested at the unit level, but its end-to-end E2E is deferred to stretch S1 / S5 (the second Claude Code session that the Ralph guide §17 reserves for MCP smoke).
