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
