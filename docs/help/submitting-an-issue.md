---
summary: "Filing high-signal issues and bug reports"
title: "Submitting an Issue"
---

## Submitting an Issue

Clear, concise issues speed up diagnosis and fixes. Include the following for bugs, regressions, or feature gaps:

### What to include

- [ ] Title: area & symptom
- [ ] Minimal repro steps
- [ ] Expected vs actual
- [ ] Impact & severity
- [ ] Environment: OS, runtime, versions, config
- [ ] Evidence: redacted logs, screenshots (non-PII)
- [ ] Scope: new, regression, or longstanding
- [ ] Searched codebase & GitHub for existing issue
- [ ] Confirmed not recently fixed/addressed
- [ ] Claims backed by evidence or repro

Be brief. Terseness > perfect grammar.

Validation (run/fix before PR):

- `bun run type-check`
- `pnpm lint`
- `pnpm build`
- `bunx vitest run --silent='passed-only' 'src/[path].test.ts'`

### Templates

#### Bug report

```md
- [ ] Minimal repro
- [ ] Expected vs actual
- [ ] Environment
- [ ] Affected channels, where not seen
- [ ] Logs/screenshots (redacted)
- [ ] Impact/severity
- [ ] Workarounds

### Summary

### Repro Steps

### Expected

### Actual

### Environment

### Logs/Evidence

### Impact

### Workarounds
```

#### Regression report

```md
### Summary

### Last Known Good

### First Known Bad

### Repro Steps

### Expected

### Actual

### Environment

### Logs/Evidence

### Impact
```

#### Feature request

```md
### Summary

### Problem

### Proposed Solution

### Alternatives

### Impact

### Evidence/examples
```

#### Enhancement

```md
### Summary

### Current vs Desired Behavior

### Rationale

### Alternatives

### Evidence/examples
```

### Submitting a fix PR

Issue before PR is optional. Include details in PR if skipping. Keep the PR focused, note issue number, add tests or explain absence, document behavior changes/risks, include redacted logs/screenshots as proof, and run proper validation before submitting.
