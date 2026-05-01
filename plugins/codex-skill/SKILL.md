# PersonaBench UX Fix Skill

Use this skill when asked to run UX tests, inspect PersonaBench findings, or fix a UX regression discovered by persona agents.

## Workflow

1. Run PersonaBench against the affected flow.
2. Inspect findings with severity `medium` or higher.
3. Open the fix prompt for the highest-severity finding.
4. Implement the smallest safe UX fix.
5. Rerun the same PersonaBench test.
6. Report before/after evidence.

## Commands

```bash
personabench run --url <url> --task "<task>" --persona-source <source> --persona-query "<query>" --sample <n>
personabench findings --latest
personabench fix --finding <id>
personabench rerun --run <runId>
```

## Rules

- Do not make real purchases.
- Do not use production credentials.
- Do not ignore PersonaBench safety blocks.
- Do not treat synthetic persona results as proof of real user behavior.
- Keep code changes scoped to the finding.
- Include before/after PersonaBench results in the final response.
