# CLI Spec

## Package

`packages/cli`

Binary:

```bash
personabench
```

## Commands

### `personabench init`

Creates:

```txt
.personabench/config.json
.personabench/runs/
.personabench/personas/cache/
```

### `personabench personas sources`

Lists available persona source presets.

Example:

```bash
personabench personas sources
```

Output:

```txt
hf:nvidia/Nemotron-Personas-Korea
hf:nvidia/Nemotron-Personas-USA
hf:nvidia/Nemotron-Personas-Japan
hf:nvidia/Nemotron-Personas-India
hf:nvidia/Nemotron-Personas-Singapore
hf:nvidia/Nemotron-Personas-Brazil
hf:nvidia/Nemotron-Personas-France
local:./personas.ndjson
mock:checkout-risk
```

### `personabench personas search`

Example:

```bash
personabench personas search \
  --source hf:nvidia/Nemotron-Personas-Korea \
  --query "price-sensitive shoppers who check hidden fees" \
  --filter "age=40..65,province=서울|경기" \
  --limit 10
```

Output:

- table preview
- optional JSON with `--json`

### `personabench run`

Example:

```bash
personabench run \
  --url http://localhost:3000/checkout \
  --task "Complete checkout up to the final confirmation. Do not make a real purchase." \
  --persona-source hf:nvidia/Nemotron-Personas-Korea \
  --persona-query "price-sensitive shopper who checks hidden fees" \
  --sample 3 \
  --viewport mobile \
  --max-duration 180 \
  --max-actions 30
```

Output:

```txt
Run created: run_...
Artifacts: .personabench/runs/run_...
Status: completed
Findings: 2 high, 1 medium
```

### `personabench report`

```bash
personabench report --latest
personabench report --run run_...
```

Generates or opens `report.html`.

### `personabench findings`

```bash
personabench findings --latest
personabench findings --run run_... --json
```

### `personabench fix`

```bash
personabench fix --finding F-001
personabench fix --finding F-001 --agent codex
personabench fix --finding F-001 --agent claude-code
```

Output:

- writes `fix-prompts/F-001.md`
- prints prompt path
- optionally prints command guidance

### `personabench rerun`

```bash
personabench rerun --run run_...
```

Uses same config/personas if available.

## Config

`.personabench/config.json`

```json
{
  "defaultPersonaSource": "hf:nvidia/Nemotron-Personas-Korea",
  "artifactDir": ".personabench/runs",
  "safety": {
    "blockPaymentSubmission": true,
    "blockDestructiveActions": true,
    "redactSensitiveFields": true
  },
  "runner": {
    "headless": false,
    "defaultViewport": "mobile",
    "maxDurationSec": 180,
    "maxActions": 30
  }
}
```

## Exit codes

- `0`: success
- `1`: generic failure
- `2`: invalid config
- `3`: persona source unavailable
- `4`: runner failed
- `5`: safety block triggered
- `6`: no findings generated
