---
summary: "How to submit a high signal PR"
title: "Submitting a PR"
---

Good PRs are easy to review: reviewers should quickly know the intent, verify behavior, and land changes safely. This guide covers concise, high-signal submissions for human and LLM review.

## What makes a good PR

- [ ] Explain the problem, why it matters, and the change.
- [ ] Keep changes focused. Avoid broad refactors.
- [ ] Summarize user-visible/config/default changes.
- [ ] List test coverage, skips, and reasons.
- [ ] Add evidence: logs, screenshots, or recordings (UI/UX).
- [ ] Run/fix relevant commands before creating PR.
- [ ] Search codebase and GitHub for related functionality/issues/fixes.
- [ ] Base claims on evidence or observation.
- [ ] Good title: verb + scope + outcome (e.g., `TitleBar: add bottom border`).

Be concise; concise review > grammar. Omit any non-applicable sections.

### Baseline validation commands (run/fix failures for your change)

- `bun run type-check`
- `pnpm lint`
- `pnpm build`
- `bunx vitest run --silent='passed-only' 'src/[path].test.ts'`

## Progressive disclosure

- Top: summary/intent
- Next: changes/risks
- Next: test/verification
- Last: implementation/evidence

## Common PR types: specifics

- [ ] Fix: Add repro, root cause, verification.
- [ ] Feature: Add use cases, behavior/demos/screenshots (UI).
- [ ] Refactor: State "no behavior change", list what moved/simplified.
- [ ] Chore: State why (e.g., build time, CI, dependencies).
- [ ] Docs: Before/after context, link updated page.
- [ ] Test: What gap is covered; how it prevents regressions.
- [ ] Perf: Add before/after metrics, and how measured.
- [ ] UX/UI: Screenshots/video, note accessibility impact.

## Checklist

- [ ] Clear problem/intent
- [ ] Focused scope
- [ ] List behavior changes
- [ ] List and result of tests
- [ ] Manual test steps (when applicable)
- [ ] No secrets/private data
- [ ] Evidence-based

## General PR Template

```md
#### Summary

#### Behavior Changes

#### Codebase and GitHub Search

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort (self-reported):
- Agent notes (optional, cite evidence):
```

## PR Type templates

### Fix

```md
#### Summary

#### Repro Steps

#### Root Cause

#### Behavior Changes

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Feature

```md
#### Summary

#### Use Cases

#### Behavior Changes

#### Existing Functionality Check

- [ ] I searched the codebase for existing functionality.
      Searches performed (1-3 bullets):
  -
  -

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Refactor

```md
#### Summary

#### Scope

#### No Behavior Change Statement

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### UX/UI

```md
#### Summary

#### Screenshots or Video

#### Accessibility Impact

#### Tests

#### Manual Testing

### Prerequisites

-

### Steps

1.
2.

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```
