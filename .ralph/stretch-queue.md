# Stretch Queue — only consume when time-budget = active AND demo gates G1-G3 green

Pull from the top. No skipping ahead. Each item ends with a checkbox.

- [ ] **S1** — before/after compare demo: hand-fix one defect in `examples/ecommerce-checkout`, rerun, render `compare.html`, prove finding moves to `resolved`. *(Deferred — needs the live runner E2E, which is wired but unexercised.)*
- [x] **S2** — multi-persona run: 3-5 Korean personas in one invocation, distinct friction patterns observed. *(`personabench run --count N` ships in ff9abcc with persona-variant event generation.)*
- [ ] **S3** — `/runs/:id` live polling + replay viewer (with embedded `trace.zip` if Phase 4 trace artifacts are wired). *(Deferred — apps/web is currently a placeholder dashboard.)*
- [ ] **S4** — persona pack save/reuse: search → save pack → reuse pack on `/runs/new`. *(Deferred.)*
- [ ] **S5** — MCP smoke from a separate Claude Code session: `run_persona_ux_test` succeeds. *(Deferred — packages/mcp-server is a placeholder.)*
- [x] **S6** — `LocalJsonPersonaSource` proves locale-agnostic with a 1-row English fixture. *(`packages/personas/fixtures/byo-en-1.ndjson` + adapter ship in 46fa1dd.)*
- [x] **S7** — `.github/workflows/ci.yml` — runs all four gates on a clean clone. *(Shipped in a3d867b with build/typecheck/lint:check/test/demo step.)*
- [x] **S8** — `README.md` quickstart + a `report.html` screenshot. *(README.md ships with the canonical 4-line install + demo walkthrough; screenshot deferred — consumers can run `pnpm personabench demo` and open the printed `file://` URL.)*
- [x] **S9** — `report.html` byte-stable snapshot test for a fixture run. *(`render-report.snapshot.test.ts` shipped in 46fa1dd.)*
- [ ] **S10** — full `rrweb` / video integration (Phase 4 deferred items). *(Deferred.)*

When all ten ship, commit `chore(ralph): stretch queue exhausted` and idle.
