# Web UI Spec

## Goal

Provide a non-developer-friendly interface for configuring persona UX tests, viewing session replays, understanding findings, and creating fix tasks.

## Primary navigation

```txt
/dashboard
/projects
/projects/:projectId
/projects/:projectId/tests
/runs/:runId
/runs/:runId/replay
/runs/:runId/findings
/runs/:runId/interview
/personas
/persona-packs
/settings/team
/settings/security
```

## Main screens

### 1. Dashboard

Purpose:

- show recent runs
- show high severity findings
- show UX health trends
- quick action to create test

Cards:

- Recent runs
- High severity findings
- Persona packs
- Before/after improvements

### 2. Test Builder

Step-based flow:

#### Step 1: Target

Fields:

- target URL
- environment: local / staging / production
- viewport: desktop / mobile
- domain allowlist
- auth profile optional

#### Step 2: Task

Fields:

- task description
- success criteria
- max duration
- max actions
- safety toggles

Example:

```txt
Task:
Complete checkout up to the final payment confirmation. Do not make a real purchase.

Success criteria:
- user finds final total
- user understands shipping fee
- user identifies next CTA
```

#### Step 3: Personas

Options:

- choose persona pack
- search Nemotron persona source
- filter metadata
- sample personas

UI elements:

- country selector
- text query
- age range
- region selector
- occupation selector
- UX behavior sliders
- sample size
- diversity controls

#### Step 4: Review and Run

Show:

- target URL
- task
- selected personas
- safety constraints
- estimated run count

### 3. Persona Search

Purpose:

- make data-grounded persona selection visible and trustworthy

UI:

```txt
Country:
[Korea v]

Target description:
[price-sensitive mobile shoppers who check hidden fees]

Filters:
Age: 40 - 65
Region: Seoul, Gyeonggi
Occupation: optional

UX traits:
Digital literacy: low ---- high
Price sensitivity: low ---- high
Risk aversion: low ---- high
Patience: low ---- high
```

Result cards:

```txt
Persona #KR-...
54 years old · Seoul · office worker

UX summary:
- checks final prices carefully
- cautious around unknown fees
- moderate mobile confidence
- likely to abandon if payment terms are unclear

Source:
NVIDIA Nemotron-Personas-Korea
```

### 4. Run Overview

Sections:

- run status
- selected personas
- task
- top findings
- artifact links
- timeline summary

### 5. Replay Page

Layout:

```txt
Left:
  replay/video/screenshot viewer

Right:
  persona card
  event timeline
  friction signals
  interview excerpt
```

Timeline item:

```txt
00:51 Long hesitation near total price
Evidence: wait action, visible checkout summary, persona confusion
```

### 6. Findings Page

Each finding card:

- severity
- title
- persona
- summary
- evidence timestamp
- observed behavior
- likely cause
- recommended fix
- confidence
- buttons:
  - View replay
  - Copy fix prompt
  - Create GitHub issue
  - Send to coding agent
  - Rerun after fix

### 7. Interview Page

Shows grounded Q&A.

Each answer should link to evidence:

```txt
Q: Where did you feel uncertain?
A: I was not sure whether the delivery fee was included.
Evidence: 00:51 long hesitation near total price, 01:12 back navigation.
```

### 8. Compare Page

For reruns:

- before/after findings
- resolved findings
- new findings
- hesitation time delta
- task success rate delta

## Design tone

- developer-friendly but not developer-only
- evidence-first
- no overclaiming
- clear provenance
- serious enough for enterprise
- fast enough for hackathon demo

## Components

Reusable components:

- `PersonaCard`
- `PersonaPackCard`
- `RunStatusBadge`
- `FindingCard`
- `FrictionTimeline`
- `ReplayViewer`
- `InterviewTranscript`
- `FixPromptModal`
- `EvidenceLink`
- `SeverityBadge`
- `SourceProvenance`

## Empty states

No runs:

```txt
Run your first persona UX test.
Choose a target URL, select a persona pack, and watch where persona agents get stuck.
```

No findings:

```txt
No major UX friction found in this run.
Review the replay to inspect behavior manually, or run additional persona packs.
```

Persona source unavailable:

```txt
Persona source is unavailable.
Check dataset access or switch to a local persona fixture.
```

## Enterprise UI additions

- team members
- roles
- audit log
- data retention settings
- private runner status
- SSO config
- custom persona libraries
