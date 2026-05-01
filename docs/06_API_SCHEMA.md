# API and Schema Spec

## REST API

### Create run

```http
POST /api/runs
```

Request:

```json
{
  "targetUrl": "http://localhost:3000/checkout",
  "task": "Complete checkout up to final confirmation. Do not make a real purchase.",
  "successCriteria": [
    "Find final total",
    "Understand shipping fee",
    "Find next CTA"
  ],
  "personaQuery": {
    "source": {
      "provider": "nvidia",
      "dataset": "nvidia/Nemotron-Personas-Korea"
    },
    "textQuery": "price-sensitive shopper who checks hidden fees",
    "demographics": {
      "ageMin": 40,
      "ageMax": 65
    },
    "sampleSize": 3
  },
  "viewport": {
    "name": "mobile",
    "width": 390,
    "height": 844
  },
  "limits": {
    "maxDurationSec": 180,
    "maxActions": 30
  },
  "safety": {
    "allowedDomains": ["localhost"],
    "blockPaymentSubmission": true,
    "blockDestructiveActions": true,
    "redactSensitiveFields": true
  }
}
```

Response:

```json
{
  "runId": "run_...",
  "status": "queued"
}
```

### Get run

```http
GET /api/runs/:runId
```

### List runs

```http
GET /api/runs
```

### Get events

```http
GET /api/runs/:runId/events
```

### Get findings

```http
GET /api/runs/:runId/findings
```

### Get interview

```http
GET /api/runs/:runId/interview
```

### Generate fix prompt

```http
POST /api/findings/:findingId/fix-prompt
```

### Rerun

```http
POST /api/runs/:runId/rerun
```

### Search personas

```http
POST /api/personas/search
```

### Create persona pack

```http
POST /api/persona-packs
```

## Core Zod schemas to create

Create Zod schemas in `packages/core/src/schemas`.

- `RunConfigSchema`
- `RunSchema`
- `PersonaRecordSchema`
- `PersonaSearchQuerySchema`
- `PersonaUXProfileSchema`
- `RunEventSchema`
- `AgentActionSchema`
- `FrictionSignalSchema`
- `UXFindingSchema`
- `InterviewSchema`
- `ArtifactSchema`

## MCP tool contracts

### `run_persona_ux_test`

Input:

```json
{
  "targetUrl": "string",
  "task": "string",
  "personaSource": "string",
  "personaQuery": "string",
  "sampleSize": 3,
  "maxDurationSec": 180
}
```

Output:

```json
{
  "runId": "string",
  "status": "queued|running|completed|failed",
  "reportUrl": "string"
}
```

### `get_ux_findings`

Input:

```json
{
  "runId": "string"
}
```

Output:

```json
{
  "findings": [
    {
      "id": "F-001",
      "severity": "high",
      "title": "string",
      "summary": "string",
      "evidence": {},
      "codingAgentPrompt": "string"
    }
  ]
}
```

### `get_replay_link`

Input:

```json
{
  "findingId": "string"
}
```

Output:

```json
{
  "replayUrl": "string",
  "videoUrl": "string",
  "traceUrl": "string",
  "timestamps": ["00:51"]
}
```

### `generate_fix_prompt`

Input:

```json
{
  "findingId": "string"
}
```

Output:

```json
{
  "prompt": "string"
}
```

### `rerun_ux_regression`

Input:

```json
{
  "runId": "string"
}
```

Output:

```json
{
  "newRunId": "string",
  "status": "queued|running|completed|failed"
}
```

## Artifact URLs

For local mode, artifact URLs can be file paths.

For hosted mode, artifact URLs should be signed URLs or authenticated routes.

Never create public replay links by default.

## Error model

Use:

```ts
type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};
```

Common codes:

- `PERSONA_SOURCE_UNAVAILABLE`
- `PERSONA_SEARCH_EMPTY`
- `RUNNER_TIMEOUT`
- `DOMAIN_NOT_ALLOWED`
- `PAYMENT_ACTION_BLOCKED`
- `ARTIFACT_NOT_FOUND`
- `FINDING_NOT_FOUND`
- `INVALID_CONFIG`
