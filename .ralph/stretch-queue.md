# Stretch Queue — only consume when time-budget = active AND demo gates G1-G3 green

Pull from the top. No skipping ahead. Each item ends with a checkbox.

- [ ] **S1** — before/after compare demo: hand-fix one defect in `examples/ecommerce-checkout`, rerun, render `compare.html`, prove finding moves to `resolved`.
- [ ] **S2** — multi-persona run: 3-5 Korean personas in one invocation, distinct friction patterns observed.
- [ ] **S3** — `/runs/:id` live polling + replay viewer (with embedded `trace.zip` if Phase 4 trace artifacts are wired).
- [ ] **S4** — persona pack save/reuse: search → save pack → reuse pack on `/runs/new`.
- [ ] **S5** — MCP smoke from a separate Claude Code session: `run_persona_ux_test` succeeds.
- [ ] **S6** — `LocalJsonPersonaSource` proves locale-agnostic with a 1-row English fixture.
- [ ] **S7** — `.github/workflows/ci.yml` — runs all four gates (G1-G4) on a clean clone.
- [ ] **S8** — `README.md` quickstart + a `report.html` screenshot.
- [ ] **S9** — `report.html` byte-stable snapshot test for a fixture run.
- [ ] **S10** — full `rrweb` / video integration (Phase 4 deferred items).

When all ten ship, commit `chore(ralph): stretch queue exhausted` and idle.
