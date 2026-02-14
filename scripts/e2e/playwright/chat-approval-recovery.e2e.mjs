#!/usr/bin/env node

import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const outputDir = path.resolve(repoRoot, "output/playwright");
const screenshotPath = path.join(outputDir, "chat-approval-recovery.png");
const replayReportPathEnv = process.env.E2E_REAL_REPORT_PATH;

function runRealApprovalCase() {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(__dirname, "chat-approval-real-electron.e2e.mjs");
    const child = spawn(process.execPath, [scriptPath], {
      cwd: repoRoot,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `real-electron case exited with code ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
          ),
        );
        return;
      }
      const passLine = stdout
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.includes("[PASS] real-electron approval e2e passed."));
      if (!passLine) {
        reject(new Error(`missing PASS line from real-electron run\nstdout:\n${stdout}`));
        return;
      }
      const match = passLine.match(/report=(.+)$/);
      if (!match?.[1]) {
        reject(new Error(`cannot parse report path from line: ${passLine}`));
        return;
      }
      resolve({
        reportPath: match[1].trim(),
        stdout,
        stderr,
      });
    });
  });
}

async function run() {
  await mkdir(outputDir, { recursive: true });
  const reportPath = replayReportPathEnv
    ? path.resolve(repoRoot, replayReportPathEnv)
    : (await runRealApprovalCase()).reportPath;
  const reportRaw = await readFile(reportPath, "utf8");
  const report = JSON.parse(reportRaw);

  const approvalResolvedStep = Array.isArray(report.steps)
    ? report.steps.find((step) => step?.name === "approval_resolved_event")
    : null;
  if (!approvalResolvedStep?.ok) {
    throw new Error(`approval_resolved_event is not ok. report=${reportPath}`);
  }

  if (
    !report?.checks?.hasPostApprovalGatewayActivity &&
    !report?.checks?.hasPostApprovalNormalizedActivity
  ) {
    throw new Error(`missing post-approval activity. report=${reportPath}`);
  }

  const afterPng = report?.files?.afterPng;
  if (typeof afterPng === "string" && afterPng.trim()) {
    await copyFile(afterPng, screenshotPath);
  } else {
    throw new Error(`missing after screenshot path in report. report=${reportPath}`);
  }

  // eslint-disable-next-line no-console
  console.log(
    `[PASS] approval recovery e2e passed. screenshot=${screenshotPath} report=${reportPath}`,
  );
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[FAIL] approval recovery e2e failed:", error);
  process.exitCode = 1;
});
