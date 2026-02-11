# Playwright E2E: Chat/Gateway Stability

## Purpose

These E2E scripts validate the P0/P1 regressions:

- after `run.approval_resolved`, chat history refresh should immediately surface the exec completion text,
- without waiting for an extra user message.
- session switch should not leak previous session content.
- heartbeat bursts should be throttled to avoid refresh storms.

## Script

- `scripts/e2e/playwright/chat-approval-recovery.e2e.mjs`
- `scripts/e2e/playwright/chat-gateway-stability.e2e.mjs`
- mock bridge: `scripts/e2e/playwright/mock-electron-api.js`

## Run Steps

1. Install deps if needed:

```bash
pnpm install
```

2. Run approval recovery E2E:

```bash
node scripts/e2e/playwright/chat-approval-recovery.e2e.mjs
```

3. Run full chat/gateway stability E2E:

```bash
node scripts/e2e/playwright/chat-gateway-stability.e2e.mjs
```

4. Optional: reuse an existing renderer server:

```bash
# terminal A
pnpm exec electron-vite --rendererOnly

# terminal B
E2E_START_SERVER=0 E2E_BASE_URL=http://localhost:5173 node scripts/e2e/playwright/chat-approval-recovery.e2e.mjs
E2E_START_SERVER=0 E2E_BASE_URL=http://localhost:5173 node scripts/e2e/playwright/chat-gateway-stability.e2e.mjs
```

## Artifact

On success, screenshot is written to:

- `output/playwright/chat-approval-recovery.png`
- `output/playwright/chat-gateway-stability.png`
