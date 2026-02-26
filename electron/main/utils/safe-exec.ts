import { app } from "electron";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface SafeExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  maxBuffer?: number;
}

/**
 * Execute a command with explicit argument array — no shell interpolation.
 */
export async function safeExecFile(
  command: string,
  args: string[],
  options: SafeExecOptions = {},
): Promise<{ stdout: string; stderr: string }> {
  const res = await execFileAsync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    timeout: options.timeoutMs ?? 60_000,
    maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
    encoding: "utf8",
  });
  return {
    stdout: String(res.stdout ?? ""),
    stderr: String(res.stderr ?? ""),
  };
}

/**
 * Build a PATH that includes well-known node directories so that
 * shebang-based scripts (`#!/usr/bin/env node`) can resolve `node`
 * even when the app is launched from Finder with a minimal PATH.
 */
export function buildEnrichedPath(): string {
  const sep = process.platform === "win32" ? ";" : ":";
  const base = process.env.PATH ?? "";

  const extra: string[] = [];

  // Embedded node shipped with ClawUI
  const embeddedBin =
    process.platform === "win32"
      ? path.join(app.getPath("userData"), "runtime", "node")
      : path.join(app.getPath("userData"), "runtime", "node", "bin");
  if (existsSync(embeddedBin)) extra.push(embeddedBin);

  // Common node / homebrew locations
  if (process.platform !== "win32") {
    for (const dir of ["/opt/homebrew/bin", "/usr/local/bin"]) {
      if (!base.includes(dir) && existsSync(dir)) extra.push(dir);
    }
  }

  return extra.length > 0 ? [...extra, base].join(sep) : base;
}

/** Return a process.env copy with enriched PATH. */
export function enrichedEnv(): NodeJS.ProcessEnv {
  return { ...process.env, PATH: buildEnrichedPath() };
}
