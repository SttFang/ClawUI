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
const screenshotPath = path.join(outputDir, "chat-approval-recovery.png");

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

    const oldText = "System: approval pending (id=e2e-approval-1)";
    const newText = "System: Exec finished (gateway id=e2e-approval-1, session=fast-coral, code 0)";

    await page.waitForSelector(`text=${oldText}`, { timeout: 15_000 });

    await page.evaluate(() => {
      const harness = window.__CLAWUI_E2E__;
      harness.switchHistory("updated");
      harness.emitNormalizedEvent({
        kind: "run.approval_resolved",
        approvalId: "e2e-approval-1",
        decision: "allow-once",
        status: "running",
      });
    });

    await page.waitForSelector(`text=${newText}`, { timeout: 10_000 });

    const oldCount = await page.locator(`text=${oldText}`).count();
    if (oldCount !== 0) {
      throw new Error("Old pending system text is still visible after approval-resolved refresh.");
    }

    await page.screenshot({ path: screenshotPath, fullPage: true });
    // eslint-disable-next-line no-console
    console.log(`[PASS] approval recovery e2e passed. screenshot=${screenshotPath}`);
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
  console.error("[FAIL] approval recovery e2e failed:", error);
  process.exitCode = 1;
});
