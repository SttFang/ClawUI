#!/usr/bin/env node

import electronBinary from "electron";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const outputDir = path.resolve(repoRoot, "output/playwright");

const startRenderer = process.env.E2E_START_SERVER !== "0";
const rendererUrl = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const rendererOrigin = new URL(rendererUrl).origin;

function nowTag() {
  return new Date().toISOString().replaceAll(":", "-");
}

function createRendererServer() {
  const child = spawn("pnpm", ["exec", "electron-vite", "--rendererOnly"], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    env: { ...process.env, CI: "1" },
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
    readLogs: () => logs.slice(-12_000),
  };
}

async function waitServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) return;
    } catch {
      // retry
    }
    await delay(250);
  }
  throw new Error(`renderer server not ready: ${url}`);
}

async function stopRendererServer(handle) {
  if (!handle?.child || handle.child.exitCode !== null) return;
  const pid = handle.child.pid;
  if (!pid) return;

  const waitForExit = new Promise((resolve) => {
    handle.child.once("exit", resolve);
  });
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    return;
  }
  await Promise.race([waitForExit, delay(2_000)]);
  if (handle.child.exitCode === null) {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      // ignore
    }
    await Promise.race([waitForExit, delay(1_000)]);
  }
}

async function waitAndSnapshot(page, filePrefix) {
  const png = `${filePrefix}.png`;
  const html = `${filePrefix}.html`;
  await page.screenshot({ path: png, fullPage: true });
  await writeFile(html, await page.content(), "utf8");
  return { png, html };
}

async function installRendererProbe(page) {
  await page.evaluate(() => {
    const globalAny = window;
    if (globalAny.__PW_ELECTRON_TRACE__) return;

    const trace = {
      installedAtMs: Date.now(),
      bindState: "init",
      bindErrors: [],
      gatewayEvents: [],
      normalizedEvents: [],
      streamEvents: [],
    };

    const push = (bucket, payload) => {
      let value = payload;
      try {
        value = JSON.parse(JSON.stringify(payload));
      } catch {
        value = { nonSerializable: true, type: typeof payload };
      }
      bucket.push({ atMs: Date.now(), payload: value });
      if (bucket.length > 800) bucket.shift();
    };

    const tryBind = () => {
      const api = globalAny.electron;
      if (!api?.gateway?.onEvent || !api?.chat?.onNormalizedEvent || !api?.chat?.onStream) {
        trace.bindState = "waiting-electron";
        return false;
      }

      try {
        const unsubs = [];
        unsubs.push(api.gateway.onEvent((frame) => push(trace.gatewayEvents, frame)));
        unsubs.push(api.chat.onNormalizedEvent((event) => push(trace.normalizedEvents, event)));
        unsubs.push(api.chat.onStream((event) => push(trace.streamEvents, event)));
        globalAny.__PW_ELECTRON_TRACE_UNSUBS__ = () => {
          for (const fn of unsubs) {
            try {
              fn?.();
            } catch {
              // noop
            }
          }
        };
        trace.bindState = "bound";
        return true;
      } catch (error) {
        trace.bindErrors.push({
          atMs: Date.now(),
          message: error instanceof Error ? error.message : String(error),
        });
        trace.bindState = "bind-failed";
        return false;
      }
    };

    if (!tryBind()) {
      const timer = window.setInterval(() => {
        if (tryBind()) window.clearInterval(timer);
      }, 200);
      globalAny.__PW_ELECTRON_TRACE_TIMER__ = timer;
    }

    globalAny.__PW_ELECTRON_TRACE__ = trace;
  });
}

async function readRendererProbe(page) {
  return page.evaluate(() => {
    const trace = window.__PW_ELECTRON_TRACE__;
    if (!trace) return null;
    return {
      installedAtMs: trace.installedAtMs,
      bindState: trace.bindState,
      bindErrors: trace.bindErrors,
      gatewayEvents: trace.gatewayEvents,
      normalizedEvents: trace.normalizedEvents,
      streamEvents: trace.streamEvents,
    };
  });
}

async function waitForGatewayEvent(page, predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const probe = await readRendererProbe(page);
    const events = Array.isArray(probe?.gatewayEvents) ? probe.gatewayEvents : [];
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const frame = events[i]?.payload;
      if (predicate(frame)) {
        return {
          atMs: typeof events[i]?.atMs === "number" ? events[i].atMs : Date.now(),
          frame,
        };
      }
    }
    await delay(250);
  }
  return null;
}

async function collectState(page, command) {
  return page.evaluate((cmd) => {
    const text = document.body.textContent ?? "";
    const commandNodes = Array.from(document.querySelectorAll("pre")).filter((pre) =>
      (pre.textContent ?? "").includes(cmd),
    );
    const statuses = Array.from(document.querySelectorAll("span,div,p"))
      .map((node) => (node.textContent ?? "").trim())
      .filter(
        (value) =>
          value === "等待你允许" ||
          value === "等待执行" ||
          value === "执行中" ||
          value === "已完成" ||
          value === "等待你允许" ||
          value === "waiting approval" ||
          value === "running" ||
          value === "completed",
      );

    return {
      hasApprovalPanel:
        text.includes("需要批准：exec @ gateway") || text.includes("Approval required"),
      hasPendingApprovalText: text.includes("等待你允许") || text.includes("approval required"),
      hasWaitingExecText: text.includes("等待执行"),
      hasRunningText: text.includes("执行中") || text.includes("running"),
      hasCompletedText: text.includes("已完成") || text.includes("completed"),
      hasSystemExecFinished: text.includes("Exec finished"),
      hasAssistantOk:
        text.includes("结果如下") ||
        text.includes("命令执行结果") ||
        text.includes("\nok\n") ||
        text.includes(" ok"),
      commandCardCount: commandNodes.length,
      statuses,
      textTail: text.slice(-1200),
    };
  }, command);
}

function collectPostApprovalActivity(rendererProbe, approvalResolvedAtMs, approvalSessionKey) {
  const normalizedAfterApproval = Array.isArray(rendererProbe?.normalizedEvents)
    ? rendererProbe.normalizedEvents.filter((entry) => {
        if (typeof entry?.atMs !== "number" || entry.atMs <= approvalResolvedAtMs) return false;
        const event = entry.payload;
        if (approvalSessionKey && event?.sessionKey && event.sessionKey !== approvalSessionKey)
          return false;
        const kind = event?.kind;
        if (kind === "run.waiting_approval" || kind === "run.approval_resolved") return false;
        if (kind === "run.lifecycle") {
          const phase = event?.metadata?.phase;
          const status = event?.status;
          return (
            status === "completed" ||
            status === "error" ||
            status === "aborted" ||
            phase === "final" ||
            phase === "end" ||
            phase === "error" ||
            phase === "aborted"
          );
        }
        if (kind === "run.started" || kind === "run.tool_started") return false;
        return true;
      })
    : [];
  const gatewayAfterApproval = Array.isArray(rendererProbe?.gatewayEvents)
    ? rendererProbe.gatewayEvents.filter((entry) => {
        if (typeof entry?.atMs !== "number" || entry.atMs <= approvalResolvedAtMs) return false;
        const frame = entry.payload;
        if (
          approvalSessionKey &&
          frame?.payload?.sessionKey &&
          frame.payload.sessionKey !== approvalSessionKey
        ) {
          return false;
        }
        if (
          frame?.event === "exec.approval.requested" ||
          frame?.event === "exec.approval.resolved"
        ) {
          return false;
        }
        if (frame?.event === "heartbeat") {
          return frame?.payload?.reason === "exec-event";
        }
        if (frame?.event === "chat") return true;
        if (frame?.event === "agent") {
          const stream = frame?.payload?.stream;
          if (stream === "assistant") return true;
          if (stream === "tool") {
            const phase = frame?.payload?.data?.phase;
            return phase === "result" || phase === "error" || phase === "end";
          }
          if (stream === "lifecycle") {
            const phase = frame?.payload?.data?.phase;
            return phase === "final" || phase === "end" || phase === "error" || phase === "abort";
          }
          return false;
        }
        return false;
      })
    : [];
  return { normalizedAfterApproval, gatewayAfterApproval };
}

async function run() {
  const tag = nowTag();
  const reportPath = path.join(outputDir, `chat-approval-real-electron-${tag}.json`);
  const tracePath = path.join(outputDir, `chat-approval-real-trace-${tag}.json`);
  const beforePrefix = path.join(outputDir, `chat-approval-real-before-${tag}`);
  const middlePrefix = path.join(outputDir, `chat-approval-real-middle-${tag}`);
  const afterPrefix = path.join(outputDir, `chat-approval-real-after-${tag}`);

  /** @type {{child: import('node:child_process').ChildProcess, readLogs: () => string} | null} */
  let rendererHandle = null;
  /** @type {import('playwright').ElectronApplication | null} */
  let electronApp = null;
  const report = {
    startedAt: new Date().toISOString(),
    files: {
      beforePng: `${beforePrefix}.png`,
      beforeHtml: `${beforePrefix}.html`,
      middlePng: `${middlePrefix}.png`,
      middleHtml: `${middlePrefix}.html`,
      afterPng: `${afterPrefix}.png`,
      afterHtml: `${afterPrefix}.html`,
      reportJson: reportPath,
      traceJson: tracePath,
    },
    steps: [],
    checks: {},
  };
  const rendererConsole = [];
  const rendererPageErrors = [];
  const electronMainStdout = [];
  const electronMainStderr = [];

  try {
    await mkdir(outputDir, { recursive: true });

    if (startRenderer) {
      rendererHandle = createRendererServer();
      await waitServer(`${rendererOrigin}/`, 30_000);
      report.steps.push({ name: "renderer", ok: true, detail: `${rendererOrigin}/` });
    } else {
      await waitServer(`${rendererOrigin}/`, 8_000);
      report.steps.push({ name: "renderer", ok: true, detail: `${rendererOrigin}/ (reused)` });
    }

    electronApp = await electron.launch({
      executablePath: electronBinary,
      args: [repoRoot],
      env: {
        ...process.env,
        ELECTRON_RENDERER_URL: rendererOrigin,
        CI: "1",
      },
    });

    const appProcess = electronApp.process();
    appProcess?.stdout?.on("data", (chunk) => {
      const text = chunk.toString();
      electronMainStdout.push({ atMs: Date.now(), text });
      if (electronMainStdout.length > 400) electronMainStdout.shift();
    });
    appProcess?.stderr?.on("data", (chunk) => {
      const text = chunk.toString();
      electronMainStderr.push({ atMs: Date.now(), text });
      if (electronMainStderr.length > 400) electronMainStderr.shift();
    });

    const page = await electronApp.firstWindow();
    page.on("console", (msg) => {
      rendererConsole.push({
        atMs: Date.now(),
        type: msg.type(),
        text: msg.text(),
      });
      if (rendererConsole.length > 800) rendererConsole.shift();
    });
    page.on("pageerror", (error) => {
      rendererPageErrors.push({
        atMs: Date.now(),
        message: error?.message ?? String(error),
      });
      if (rendererPageErrors.length > 200) rendererPageErrors.shift();
    });

    await page.waitForLoadState("domcontentloaded");
    await page.waitForSelector("textarea", { timeout: 30_000 });
    await installRendererProbe(page);
    report.steps.push({ name: "app_loaded", ok: true });

    const connected = await page.evaluate(async () => {
      const api = window.electron?.chat;
      if (!api) return false;
      try {
        const alive = await api.isConnected();
        if (alive) return true;
        return await api.connect();
      } catch {
        return false;
      }
    });
    report.steps.push({ name: "chat_connected", ok: connected, detail: String(connected) });

    let startedFreshSession = false;
    const newSessionBtn = page
      .locator("button")
      .filter({ hasText: /新建会话|New conversation/i })
      .first();
    if (await newSessionBtn.count()) {
      try {
        await newSessionBtn.click({ timeout: 3000 });
        startedFreshSession = true;
        await delay(400);
      } catch {
        startedFreshSession = false;
      }
    }
    report.steps.push({
      name: "new_session",
      ok: true,
      detail: startedFreshSession ? "created" : "skipped(use-current-session)",
    });

    const command = `python3 -c "import time;time.sleep(2);print('ok')"`;
    const prompt = `请执行命令 ${command} 并返回结果`;
    const textarea = page.locator("textarea").first();
    await page.waitForFunction(
      () => {
        const el = document.querySelector("textarea");
        return !!el && !(el instanceof HTMLTextAreaElement ? el.disabled : false);
      },
      { timeout: 20_000 },
    );
    await textarea.fill(prompt);
    const sendBtn = page.getByRole("button", { name: "发送" });
    await page.waitForFunction(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(
        (node) => (node.textContent ?? "").trim() === "发送",
      );
      return !!btn && !(btn instanceof HTMLButtonElement ? btn.disabled : false);
    });
    await sendBtn.click();
    report.steps.push({ name: "send", ok: true, detail: prompt });

    await waitAndSnapshot(page, beforePrefix);
    report.steps.push({ name: "before_snapshot", ok: true });

    const approvalRequestedHit = await waitForGatewayEvent(
      page,
      (frame) => frame?.event === "exec.approval.requested",
      15_000,
    );
    report.steps.push({
      name: "approval_requested_event",
      ok: Boolean(approvalRequestedHit?.frame),
      detail: approvalRequestedHit?.frame
        ? JSON.stringify({
            id: approvalRequestedHit.frame.payload?.id ?? null,
            sessionKey: approvalRequestedHit.frame.payload?.request?.sessionKey ?? null,
            command: approvalRequestedHit.frame.payload?.request?.command ?? null,
          })
        : "timeout",
    });

    const allowOnceBtn = page
      .locator("button")
      .filter({ hasText: /仅本次允许|Allow once/i })
      .first();
    let approvalPanelVisible = false;
    if (await allowOnceBtn.count()) {
      approvalPanelVisible = true;
    } else {
      try {
        await page
          .getByText(/需要批准：exec @ gateway|Approval required/i)
          .first()
          .waitFor({ timeout: 3000 });
        approvalPanelVisible = true;
      } catch {
        approvalPanelVisible = false;
      }
    }
    report.steps.push({
      name: "approval_panel",
      ok: true,
      detail: approvalPanelVisible ? "visible" : "not-visible(auto-allow)",
    });

    if (approvalPanelVisible) {
      if (await allowOnceBtn.count()) {
        await allowOnceBtn.click();
        report.steps.push({ name: "allow_once_click", ok: true });
      } else {
        report.steps.push({ name: "allow_once_click", ok: false, detail: "button-not-found" });
      }
    } else {
      report.steps.push({ name: "allow_once_click", ok: true, detail: "skipped" });
    }

    const approvalResolvedHit = await waitForGatewayEvent(
      page,
      (frame) => frame?.event === "exec.approval.resolved",
      15_000,
    );
    report.steps.push({
      name: "approval_resolved_event",
      ok: Boolean(approvalResolvedHit?.frame),
      detail: approvalResolvedHit?.frame
        ? JSON.stringify({
            id:
              approvalResolvedHit.frame.payload?.id ??
              approvalResolvedHit.frame.payload?.request?.id ??
              null,
            decision: approvalResolvedHit.frame.payload?.decision ?? null,
          })
        : "timeout",
    });

    await waitAndSnapshot(page, middlePrefix);
    report.steps.push({ name: "middle_snapshot", ok: true });

    const approvalResolvedAtMs = approvalResolvedHit?.atMs ?? 0;
    const approvalSessionKey =
      approvalRequestedHit?.frame?.payload?.request?.sessionKey ??
      approvalResolvedHit?.frame?.payload?.request?.sessionKey ??
      approvalResolvedHit?.frame?.payload?.sessionKey ??
      null;

    let finalState = await collectState(page, command);
    let postApprovalActivity = {
      normalizedAfterApproval: [],
      gatewayAfterApproval: [],
    };
    const deadline = Date.now() + 35_000;
    while (Date.now() < deadline) {
      finalState = await collectState(page, command);
      const probeTick = await readRendererProbe(page);
      postApprovalActivity = collectPostApprovalActivity(
        probeTick,
        approvalResolvedAtMs,
        approvalSessionKey,
      );
      const hasPostApprovalActivity =
        postApprovalActivity.normalizedAfterApproval.length > 0 ||
        postApprovalActivity.gatewayAfterApproval.length > 0;
      const hasResultSignal =
        finalState.hasSystemExecFinished ||
        finalState.hasAssistantOk ||
        finalState.hasCompletedText;
      if (hasPostApprovalActivity && hasResultSignal) {
        break;
      }
      await delay(500);
    }

    await waitAndSnapshot(page, afterPrefix);
    report.steps.push({ name: "after_snapshot", ok: true });
    report.checks = finalState;

    const rendererProbe = await readRendererProbe(page);
    await writeFile(
      tracePath,
      JSON.stringify(
        {
          startedAt: report.startedAt,
          endedAt: new Date().toISOString(),
          rendererProbe,
          rendererConsole,
          rendererPageErrors,
          electronMainStdout,
          electronMainStderr,
        },
        null,
        2,
      ),
    );
    report.steps.push({
      name: "trace_dumped",
      ok: true,
      detail: tracePath,
    });
    const latestPostApprovalActivity = collectPostApprovalActivity(
      rendererProbe,
      approvalResolvedAtMs,
      approvalSessionKey,
    );
    const normalizedAfterApproval =
      latestPostApprovalActivity.normalizedAfterApproval.length >
      postApprovalActivity.normalizedAfterApproval.length
        ? latestPostApprovalActivity.normalizedAfterApproval
        : postApprovalActivity.normalizedAfterApproval;
    const gatewayAfterApproval =
      latestPostApprovalActivity.gatewayAfterApproval.length >
      postApprovalActivity.gatewayAfterApproval.length
        ? latestPostApprovalActivity.gatewayAfterApproval
        : postApprovalActivity.gatewayAfterApproval;

    report.traceSummary = {
      gatewayEvents: Array.isArray(rendererProbe?.gatewayEvents)
        ? rendererProbe.gatewayEvents.length
        : 0,
      normalizedEvents: Array.isArray(rendererProbe?.normalizedEvents)
        ? rendererProbe.normalizedEvents.length
        : 0,
      streamEvents: Array.isArray(rendererProbe?.streamEvents)
        ? rendererProbe.streamEvents.length
        : 0,
      rendererConsole: rendererConsole.length,
      rendererPageErrors: rendererPageErrors.length,
      mainStdoutLines: electronMainStdout.length,
      mainStderrLines: electronMainStderr.length,
      normalizedAfterApproval: normalizedAfterApproval.length,
      gatewayAfterApproval: gatewayAfterApproval.length,
    };
    report.checks = {
      ...report.checks,
      hasPostApprovalNormalizedActivity: normalizedAfterApproval.length > 0,
      hasPostApprovalGatewayActivity: gatewayAfterApproval.length > 0,
      hasResultSignal:
        Boolean(report.checks?.hasSystemExecFinished) ||
        Boolean(report.checks?.hasAssistantOk) ||
        Boolean(report.checks?.hasCompletedText),
    };

    const pass =
      Boolean(approvalResolvedHit?.frame) &&
      (normalizedAfterApproval.length > 0 || gatewayAfterApproval.length > 0) &&
      (finalState.hasSystemExecFinished ||
        finalState.hasAssistantOk ||
        finalState.hasCompletedText);
    if (!pass) {
      throw new Error(
        "approval accepted but no post-approval gateway/normalized activity for the same session",
      );
    }

    await writeFile(
      reportPath,
      JSON.stringify({ ...report, endedAt: new Date().toISOString() }, null, 2),
    );
    // eslint-disable-next-line no-console
    console.log(`[PASS] real-electron approval e2e passed. report=${reportPath}`);
  } catch (error) {
    await writeFile(
      reportPath,
      JSON.stringify(
        {
          ...report,
          endedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      ),
    );
    // eslint-disable-next-line no-console
    console.error(`[FAIL] real-electron approval e2e failed. report=${reportPath}`);
    // eslint-disable-next-line no-console
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
  } finally {
    if (electronApp) {
      await electronApp.close();
    }
    await stopRendererServer(rendererHandle);
    if (rendererHandle && rendererHandle.child.exitCode && rendererHandle.child.exitCode !== 0) {
      // eslint-disable-next-line no-console
      console.error(rendererHandle.readLogs());
    }
  }
}

run();
