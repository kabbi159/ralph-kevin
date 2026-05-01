# /ux-fix

Fix a PersonaBench UX finding.

## Usage

```txt
/ux-fix F-001
```

## Behavior

1. Read the PersonaBench finding.
2. Read the generated fix prompt.
3. Identify the smallest safe code change.
4. Implement the fix.
5. Rerun the same PersonaBench test.
6. Report before/after evidence.

## Constraints

- Do not perform a full redesign.
- Do not change unrelated business logic.
- Do not remove safety checks.
- Keep the implementation tied to the evidence in the finding.
