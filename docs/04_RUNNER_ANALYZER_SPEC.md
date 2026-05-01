# Runner and Analyzer Spec

## Goal

Run persona agents through a target URL and produce replay-backed UX findings.

## Browser substrate

PersonaBench's runner is built on **`agent-browser`** (Vercel Labs, npm: `agent-browser`). The runner spawns the CLI as a long-lived daemon for each run, addressing it via `--session <runId>`. Browser primitives map one-to-one onto agent-browser commands:

| PersonaBench primitive | agent-browser command |
|---|---|
| start session, navigate | `agent-browser --session <id> open <url>` |
| observe page | `agent-browser --session <id> snapshot --json` |
| click element | `agent-browser --session <id> click @<ref>` |
| type into input | `agent-browser --session <id> fill @<ref> "<text>"` |
| scroll | `agent-browser --session <id> scroll <direction>` |
| go back | `agent-browser --session <id> back` |
| screenshot | `agent-browser --session <id> screenshot <path>` |
| trace | `agent-browser --session <id> trace start \| stop` |
| close session | `agent-browser --session <id> close` |

Snapshots return a structured accessibility tree with stable element refs (`e1`, `e2`, …). The runner stores the snapshot verbatim under `.personabench/runs/<runId>/observations/<step>.json` and feeds a compacted version to the `DecisionProvider`.

The runner does **not** use `agent-browser chat`. That command depends on the Vercel AI Gateway and uses a fixed system prompt, which is incompatible with PersonaBench's persona-injection design. Persona-aware decisions go through a `DecisionProvider` interface (default: `ClaudeDecisionProvider` calling the Anthropic SDK with `claude-haiku-4-5-20251001`).

## Runner loop

```txt
agent-browser --session <runId> open <targetUrl>
loop until stop:
  observation := agent-browser --session <runId> snapshot --json
  -> compact observation (visible text + interactive refs + screenshot path)
  -> decision := DecisionProvider.decide({ observation, persona, task, recentHistory })
  -> safety check (allowlist, payment block, destructive block)
  -> execute via the corresponding agent-browser command
  -> capture screenshot via `agent-browser screenshot`
  -> log RunEvent (observation, action, result, thoughtSummary)
  -> detect stop condition (maxActions, maxDurationSec, action.type === "stop", safety violation)
agent-browser --session <runId> close
```

## Run config

```ts
export type RunConfig = {
  id: string;
  projectId?: string;

  targetUrl: string;
  task: string;
  successCriteria?: string[];

  personaSource?: string;
  personaQuery?: string;
  personaIds?: string[];
  personaPackId?: string;
  sampleSize?: number;

  viewport?: {
    name: "mobile" | "desktop";
    width: number;
    height: number;
  };

  limits: {
    maxDurationSec: number;
    maxActions: number;
  };

  safety: {
    allowedDomains: string[];
    blockPaymentSubmission: boolean;
    blockDestructiveActions: boolean;
    redactSensitiveFields: boolean;
  };

  artifacts: {
    screenshots: boolean;
    video: boolean;
    trace: boolean;
    rrweb: boolean;
  };
};
```

## Agent action schema

```ts
export type AgentAction =
  | { type: "click"; selector?: string; x?: number; y?: number; reason: string }
  | { type: "type"; selector?: string; text: string; reason: string }
  | { type: "scroll"; direction: "up" | "down"; amount?: number; reason: string }
  | { type: "wait"; durationMs: number; reason: string }
  | { type: "back"; reason: string }
  | { type: "stop"; outcome: "success" | "dropoff" | "blocked" | "timeout"; reason: string };
```

## Run event schema

```ts
export type RunEvent = {
  id: string;
  runId: string;
  personaId: string;

  timestampMs: number;
  stepIndex: number;

  page: {
    url: string;
    title?: string;
  };

  observation?: {
    visibleText?: string;
    interactiveElements?: Array<{
      role?: string;
      label?: string;
      selector?: string;
      boundingBox?: { x: number; y: number; width: number; height: number };
    }>;
  };

  action?: AgentAction;

  result?: {
    urlChanged?: boolean;
    domChanged?: boolean;
    errorText?: string[];
    screenshotPath?: string;
  };

  thoughtSummary?: string;
};
```

## Observations

The runner should not feed the full DOM into the LLM.

Extract:

- URL
- page title
- visible headings
- buttons and links
- inputs and labels
- visible error messages
- price/payment/shipping text
- aria labels
- selected text near CTA
- screenshot reference if multimodal available

## Action safety

Before executing an action:

- verify domain allowlist
- block real purchase / submit payment by default
- block account deletion or irreversible actions
- block downloads unless explicitly allowed
- mask typed secrets
- obey max action count

## Friction signals

```ts
export type FrictionSignal = {
  id: string;
  runId: string;
  personaId: string;

  type:
    | "long_hesitation"
    | "repeated_click"
    | "dead_click"
    | "backtrack"
    | "form_error"
    | "scroll_search"
    | "task_abandonment"
    | "cta_not_found"
    | "copy_confusion"
    | "price_uncertainty"
    | "trust_uncertainty";

  severityHint: "low" | "medium" | "high";

  timestampStartMs: number;
  timestampEndMs?: number;

  evidence: {
    eventIds: string[];
    screenshotPaths?: string[];
    notes: string;
  };
};
```

## Detection heuristics

### long_hesitation

Trigger:

- wait action >= 10 seconds
- or no meaningful action for >= 15 seconds
- or persona thought says confusion and no progress

### repeated_click

Trigger:

- 3+ clicks within same approximate region or selector within 10 seconds

### dead_click

Trigger:

- click action with no URL change, no DOM change, no visible state change

### backtrack

Trigger:

- browser back
- returning to previous page after failed progress
- repeated navigation between same two pages

### form_error

Trigger:

- visible validation error
- input rejected
- disabled submit after form entry

### scroll_search

Trigger:

- 3+ scrolls without meaningful click
- scroll up/down repeated around same area

### task_abandonment

Trigger:

- stop outcome `dropoff`
- timeout after repeated friction
- persona reason says unwilling/unable to continue

### CTA not found

Trigger:

- task requires progression
- agent searches/scrolls/clicks alternatives
- no primary CTA clicked

### price_uncertainty

Trigger:

- visible price/shipping/payment area
- persona asks about final amount, fee, shipping, discount, refund
- hesitation around checkout

### trust_uncertainty

Trigger:

- persona asks about privacy, safety, refund, hidden costs, legitimacy
- hesitation near signup/payment/permission step

## Severity scoring

Severity levels:

```txt
critical: blocks task completion for multiple personas
high: causes drop-off or inability to continue
medium: causes significant hesitation/backtracking but task eventually completes
low: minor confusion with little impact
```

## Finding generation

A finding should aggregate related friction signals.

```ts
export type UXFinding = {
  id: string;
  runId: string;
  severity: "low" | "medium" | "high" | "critical";

  title: string;
  summary: string;

  persona: {
    id: string;
    displayName: string;
  };

  evidence: {
    timestamps: string[];
    eventIds: string[];
    frictionSignalIds: string[];
    screenshots?: string[];
    videoPath?: string;
    tracePath?: string;
    replayPath?: string;
  };

  diagnosis: {
    userGoal: string;
    observedBehavior: string;
    likelyCause: string;
    confidence: number;
  };

  recommendation: {
    uxChange: string;
    implementationHint?: string;
    acceptanceCriteria: string[];
  };

  codingAgentPrompt: string;
};
```

## Coding-agent fix prompt structure

Each fix prompt should include:

```md
# UX Fix Task: <finding title>

## Context
- Product flow:
- URL:
- Persona:
- Task:

## Observed behavior
...

## Evidence
- Timestamp:
- Events:
- Screenshot:
- Replay:

## Likely cause
...

## Required fix
...

## Acceptance criteria
...

## Constraints
- Keep scope small.
- Do not introduce unrelated redesigns.
- Do not change business logic unless necessary.
- Rerun PersonaBench after the fix.
```

## Interview generation

The interview must be grounded in the run.

Questions:

1. Did you feel able to complete the task?
2. Where did you feel most uncertain?
3. What information was missing?
4. Why did you hesitate, go back, or stop?
5. What change would help you continue?

Do not allow the interview generator to invent issues that are not supported by logs.
