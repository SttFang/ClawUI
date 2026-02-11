# Playwright E2E: Approval Recovery

## Purpose

This E2E script validates the P0 regression:

- after `run.approval_resolved`, chat history refresh should immediately surface the exec completion text,
- without waiting for an extra user message.

## Script

- `scripts/e2e/playwright/chat-approval-recovery.e2e.mjs`
- mock bridge: `scripts/e2e/playwright/mock-electron-api.js`

## Run Steps

1. Install deps if needed:

```bash
pnpm install
```

2. Run the E2E script (it auto-starts renderer server):

```bash
node scripts/e2e/playwright/chat-approval-recovery.e2e.mjs
```

3. Optional: reuse an existing renderer server:

```bash
# terminal A
pnpm exec electron-vite --rendererOnly

# terminal B
E2E_START_SERVER=0 E2E_BASE_URL=http://localhost:5173 node scripts/e2e/playwright/chat-approval-recovery.e2e.mjs
```

## Artifact

On success, screenshot is written to:

- `output/playwright/chat-approval-recovery.png`
