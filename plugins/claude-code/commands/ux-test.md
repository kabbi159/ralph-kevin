# /ux-test

Run a PersonaBench UX test.

## Usage

```txt
/ux-test url=http://localhost:3000/checkout task="Complete checkout up to final confirmation" persona="price-sensitive shopper" sample=3
```

## Behavior

1. Build a PersonaBench command from the arguments.
2. Run the test.
3. Summarize findings.
4. Link to report artifacts.
5. Recommend the highest-priority fix.

## Safety

Do not run against production flows that can perform real purchases, destructive changes, or send real user communications unless explicit safety blocks are configured.
