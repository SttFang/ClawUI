#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const startServer = process.env.E2E_START_SERVER !== "0";
const parsedBase = new URL(baseUrl);
const serverOrigin = parsedBase.origin;

const mockApiPath = path.resolve(__dirname, "mock-electron-api.js");
const outputDir = path.resolve(repoRoot, "output/playwright");
const screenshotPath = path.join(outputDir, "chat-gateway-stability.png");

function createServerCommand() {
  return {
    cmd: "pnpm",
    args: ["exec", "electron-vite", "--rendererOnly"],
  };
}

async function waitForServerReady(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) return;
    } catch {
      // ignore and retry
    }
    await delay(250);
  }
  throw new Error(`Renderer server did not become ready in ${timeoutMs}ms: ${url}`);
}

function startRendererServer() {
  const { cmd, args } = createServerCommand();
  const child = spawn(cmd, args, {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CI: "1" },
    detached: true,
  });

  let logs = "";
  child.stdout?.on("data", (chunk) => {
    logs += chunk.toString();
  });
  child.stderr?.on("data", (chunk) => {
    logs += chunk.toString();
  });

  return {
    child,
    readLogs() {
      return logs.slice(-12_000);
    },
  };
}

async function stopRendererServer(serverHandle) {
  if (!serverHandle?.child || serverHandle.child.exitCode !== null) return;
  const pid = serverHandle.child.pid;
  if (!pid) return;

  const waitForExit = new Promise((resolve) => {
    serverHandle.child.once("exit", resolve);
  });

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    return;
  }

  await Promise.race([waitForExit, delay(2_000)]);
  if (serverHandle.child.exitCode === null) {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      // ignore
    }
    await Promise.race([waitForExit, delay(1_000)]);
  }
}

async function run() {
  let serverHandle = null;
  let browser = null;

  try {
    if (startServer) {
      serverHandle = startRendererServer();
      await waitForServerReady(`${serverOrigin}/`, 30_000);
    } else {
      await waitForServerReady(`${serverOrigin}/`, 8_000);
    }

    await mkdir(outputDir, { recursive: true });

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.addInitScript({ path: mockApiPath });

    await page.goto(`${serverOrigin}/#/`, { waitUntil: "domcontentloaded" });

    const pendingText = "System: approval pending (id=e2e-approval-1)";
    const finishedText =
      "System: Exec finished (gateway id=e2e-approval-1, session=fast-coral, code 0)";
    await page.waitForSelector(`text=${pendingText}`, { timeout: 15_000 });
    await page.evaluate(() => {
      window.__CLAWUI_E2E__.resetAgentRequests();
    });

    // Scenario 1/2: approval resolved should trigger immediate refresh and render finish text
    const beforeCount = await page.evaluate(() => window.__CLAWUI_E2E__.getHistoryRequestCount());
    await page.evaluate(() => {
      const harness = window.__CLAWUI_E2E__;
      harness.switchHistory("updated");
      harness.emitNormalizedEvent({
        kind: "run.approval_resolved",
        approvalId: "e2e-approval-1",
        decision: "allow-once",
        sessionKey: harness.sessionKey,
        clientRunId: "e2e-run-approval-1",
        command: "ls -la ~/Desktop",
        status: "running",
      });
      harness.emitGatewayEvent({
        type: "event",
        event: "exec.approval.resolved",
        payload: {
          id: "e2e-approval-1",
          decision: "allow-once",
          request: {
            id: "e2e-approval-1",
            sessionKey: harness.sessionKey,
            command: "ls -la ~/Desktop",
          },
        },
      });
      harness.emitGatewayEvent({
        type: "event",
        event: "agent",
        payload: {
          runId: "e2e-run-approval-1",
          stream: "tool",
          data: {
            name: "exec",
            phase: "result",
            toolCallId: "tc-e2e-approval-1",
            result:
              "System: Exec finished (gateway id=e2e-approval-1, session=fast-coral, code 0)\nTOTAL 15",
          },
        },
      });
    });

    await page.waitForFunction(
      (prev) => window.__CLAWUI_E2E__.getHistoryRequestCount() > prev,
      beforeCount,
      { timeout: 1_000 },
    );
    await page.waitForSelector(`text=${finishedText}`, { timeout: 10_000 });
    await page.waitForFunction(() => window.__CLAWUI_E2E__.getAgentRequestCount() > 0, {
      timeout: 3_000,
    });
    const firstAgentRequest = await page.evaluate(
      () => window.__CLAWUI_E2E__.getAgentRequests()[0],
    );
    const firstMessage =
      firstAgentRequest && typeof firstAgentRequest.message === "string"
        ? firstAgentRequest.message
        : "";
    if (!firstMessage.toLowerCase().includes("exec finished")) {
      throw new Error(`Unexpected first agent handoff message: ${firstMessage}`);
    }
    if (firstMessage.includes("结果：你的桌面已经很干净了。")) {
      throw new Error(`Unexpected cross-message handoff content: ${firstMessage}`);
    }

    const oldCount = await page.locator(`text=${pendingText}`).count();
    if (oldCount !== 0) {
      throw new Error("Pending approval text is still visible after resolved refresh.");
    }

    // Scenario 3: session switch should not leak previous session content
    await page.getByText("E2E Secondary Session").first().click();
    await page.waitForSelector("text=第二轮测试", { timeout: 10_000 });
    const leakedPrimaryCount = await page.locator(`text=${finishedText}`).count();
    if (leakedPrimaryCount !== 0) {
      throw new Error("Primary session content leaked into secondary session.");
    }

    // Scenario 4: heartbeat burst should be throttled/backed off
    await page.evaluate(() => {
      const harness = window.__CLAWUI_E2E__;
      const secondary = harness.secondarySessionKey;
      harness.resetHistoryRequestCount(secondary);
      for (let i = 0; i < 12; i += 1) {
        harness.emitGatewayEvent({
          type: "event",
          event: "heartbeat",
          payload: {},
        });
      }
    });
    await delay(2_500);
    const heartbeatRefreshCount = await page.evaluate(() =>
      window.__CLAWUI_E2E__.getHistoryRequestCount(window.__CLAWUI_E2E__.secondarySessionKey),
    );
    if (heartbeatRefreshCount > 6) {
      throw new Error(`Heartbeat refreshes too noisy: ${heartbeatRefreshCount}`);
    }

    await page.screenshot({ path: screenshotPath, fullPage: true });
    // eslint-disable-next-line no-console
    console.log(`[PASS] chat gateway stability e2e passed. screenshot=${screenshotPath}`);
  } finally {
    if (browser) {
      await browser.close();
    }
    await stopRendererServer(serverHandle);
    if (serverHandle && serverHandle.child.exitCode && serverHandle.child.exitCode !== 0) {
      // eslint-disable-next-line no-console
      console.error(serverHandle.readLogs());
    }
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[FAIL] chat gateway stability e2e failed:", error);
  process.exitCode = 1;
});
