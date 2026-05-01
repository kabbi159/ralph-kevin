#!/usr/bin/env node
const args = process.argv.slice(2);
const cmd = args[0] ?? "help";

if (cmd === "--version" || cmd === "-v") {
  console.log("personabench 0.1.0");
  process.exit(0);
}

if (cmd === "help" || cmd === "--help" || cmd === "-h") {
  console.log(`personabench — data-grounded persona UX testing CLI

Usage:
  personabench <command> [options]

Commands (Phase 0 stub — wired in later phases):
  init                    Initialize .personabench/ in current directory
  personas search         Search persona dataset
  run                     Run a persona UX test
  report                  Generate report.html for a run
  findings                List findings for a run
  fix                     Generate fix prompt for a finding
  rerun                   Rerun a previous configuration
  compare <a> <b>         Compare two runs
  serve                   Launch the web app
  mcp                     Launch the MCP server
  demo                    One-command demo (G3 gate)
  demo:crack              Crack live-site demo
  install                 Register CLI globally + MCP entry + plugin link (G4 gate)
  uninstall               Reverse install
`);
  process.exit(0);
}

console.error(`personabench: command "${cmd}" not yet implemented in this phase`);
process.exit(2);
