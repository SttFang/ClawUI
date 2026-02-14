#!/usr/bin/env node

/**
 * Settings tabs E2E test (renderer-only + mock injection)
 *
 * Verifies the 4-tab settings layout:
 *   TC1: 4 tabs rendered
 *   TC2: Tab switching
 *   TC3: Alias route (?tab=messaging)
 *   TC4: Section anchor (?tab=capabilities&section=plugins)
 *   TC5: Default tab (no params)
 *   TC6: Screenshots
 *
 * Usage:
 *   E2E_START_SERVER=0 E2E_BASE_URL=http://localhost:5173 node scripts/e2e/playwright/settings-tabs.e2e.mjs
 *   # or auto-start dev server:
 *   node scripts/e2e/playwright/settings-tabs.e2e.mjs
 */

import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const outputDir = path.resolve(repoRoot, "output/playwright");
const mockScript = await readFile(path.resolve(__dirname, "mock-electron-api.js"), "utf8");

const startServer = process.env.E2E_START_SERVER !== "0";
const baseUrl = process.env.E2E_BASE_URL || "http://localhost:5173";

let serverProcess = null;

async function startDevServer() {
  if (!startServer) return;
  console.log("[INFO] Starting dev server...");
  serverProcess = spawn("pnpm", ["dev"], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Dev server failed to start within 30s")),
      30000,
    );
    serverProcess.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      if (text.includes("Local:") || text.includes("ready in")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    serverProcess.once("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
  console.log("[INFO] Dev server ready.");
}

function stopDevServer() {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
}

const results = [];

function assert(name, condition, detail) {
  if (condition) {
    results.push({ name, ok: true });
    console.log(`  [PASS] ${name}`);
  } else {
    results.push({ name, ok: false, detail });
    console.log(`  [FAIL] ${name} — ${detail || ""}`);
  }
}

async function run() {
  await mkdir(outputDir, { recursive: true });
  await startDevServer();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });

  // Inject mock before each page navigation
  await context.addInitScript(mockScript);

  const page = await context.newPage();

  try {
    // --- TC5: Default tab ---
    console.log("\nTC5: Default tab");
    await page.goto(`${baseUrl}/#/settings`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    const defaultActiveTab = await page.locator('[role="tab"][data-state="active"]').textContent();
    assert(
      "TC5: default tab is General/通用",
      defaultActiveTab === "通用" || defaultActiveTab === "General",
    );

    // --- TC1: 4 tabs rendered ---
    console.log("\nTC1: 4 tabs rendered");
    const tabs = await page.locator('[role="tab"]').allTextContents();
    assert(
      "TC1: exactly 4 tabs",
      tabs.length === 4,
      `found ${tabs.length}: ${JSON.stringify(tabs)}`,
    );

    const expectedZh = ["通用", "AI 服务", "消息平台", "功能"];
    const expectedEn = ["General", "AI Services", "Messaging", "Capabilities"];
    const matchesZh = JSON.stringify(tabs) === JSON.stringify(expectedZh);
    const matchesEn = JSON.stringify(tabs) === JSON.stringify(expectedEn);
    assert("TC1: tab names match", matchesZh || matchesEn, `got: ${JSON.stringify(tabs)}`);

    // Screenshot: General tab
    await page.screenshot({ path: path.join(outputDir, "settings-general.png") });

    // --- TC2: Tab switching ---
    console.log("\nTC2: Tab switching");

    // Click AI Services tab
    await page.locator('[role="tab"]').nth(1).click();
    await page.waitForTimeout(300);
    const aiActive = await page.locator('[role="tab"][data-state="active"]').textContent();
    assert(
      "TC2: AI tab active",
      aiActive === "AI 服务" || aiActive === "AI Services",
      `got: ${aiActive}`,
    );
    await page.screenshot({ path: path.join(outputDir, "settings-ai.png") });

    // Click Messaging tab
    await page.locator('[role="tab"]').nth(2).click();
    await page.waitForTimeout(300);
    const msgActive = await page.locator('[role="tab"][data-state="active"]').textContent();
    assert(
      "TC2: Messaging tab active",
      msgActive === "消息平台" || msgActive === "Messaging",
      `got: ${msgActive}`,
    );
    await page.screenshot({ path: path.join(outputDir, "settings-messaging.png") });

    // Click Capabilities tab
    await page.locator('[role="tab"]').nth(3).click();
    await page.waitForTimeout(300);
    const capActive = await page.locator('[role="tab"][data-state="active"]').textContent();
    assert(
      "TC2: Capabilities tab active",
      capActive === "功能" || capActive === "Capabilities",
      `got: ${capActive}`,
    );
    await page.screenshot({ path: path.join(outputDir, "settings-capabilities.png") });

    // --- TC3: Alias route ---
    console.log("\nTC3: Alias route ?tab=messaging");
    await page.goto(`${baseUrl}/#/settings?tab=messaging`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const aliasActive = await page.locator('[role="tab"][data-state="active"]').textContent();
    assert(
      "TC3: messaging tab active via URL",
      aliasActive === "消息平台" || aliasActive === "Messaging",
      `got: ${aliasActive}`,
    );

    // --- TC4: Section anchor ---
    console.log("\nTC4: Section anchor ?tab=capabilities&section=plugins");
    await page.goto(`${baseUrl}/#/settings?tab=capabilities&section=plugins`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(500);
    const sectionActive = await page.locator('[role="tab"][data-state="active"]').textContent();
    assert(
      "TC4: capabilities tab active",
      sectionActive === "功能" || sectionActive === "Capabilities",
      `got: ${sectionActive}`,
    );

    // Check that plugins section is visible
    const pluginsVisible = await page
      .locator("text=插件")
      .or(page.locator("text=Plugins"))
      .first()
      .isVisible();
    assert("TC4: plugins section visible", pluginsVisible);

    // --- TC6: Screenshots already captured above ---
    console.log("\nTC6: Screenshots");
    assert("TC6: screenshots saved to output/playwright/settings-*.png", true);
  } finally {
    await browser.close();
    stopDevServer();
  }

  // Summary
  console.log("\n--- Results ---");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`${passed} passed, ${failed} failed out of ${results.length} assertions`);

  if (failed > 0) {
    console.log("\nFailed assertions:");
    for (const r of results.filter((r) => !r.ok)) {
      console.log(`  - ${r.name}: ${r.detail || ""}`);
    }
    process.exit(1);
  } else {
    console.log("\n[PASS] settings-tabs e2e passed.");
  }
}

run().catch((err) => {
  console.error("[FATAL]", err);
  stopDevServer();
  process.exit(1);
});
