import type { OpenClawInstall } from "@clawui/types/onboarding";
import { app } from "electron";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { resolveCommandPath, execInLoginShell } from "./login-shell";
import { safeExecFile } from "./safe-exec";

const execFileAsync = promisify(execFile);

export type OpenClawExecResult = {
  stdout: string;
  stderr: string;
};

export function trimArg(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const next = value.trim();
  return next ? next : null;
}

export function assertProvider(value: unknown): string {
  const provider = trimArg(value);
  if (!provider) {
    throw new Error("provider is required");
  }
  return provider;
}

export function parseJson<T>(output: string, context: string): T {
  const raw = output.trim();
  if (!raw) {
    throw new Error(`${context}: empty output`);
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    // CLI may prefix JSON with diagnostic output (e.g. doctor warnings).
    // Try to extract the last JSON object or array from the output.
    const match = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])\s*$/);
    if (match) {
      try {
        return JSON.parse(match[1]) as T;
      } catch {
        // fall through
      }
    }
    throw new Error(`${context}: invalid JSON output`);
  }
}

export async function resolveOpenClawPath(): Promise<string> {
  const openclawPath = await resolveCommandPath("openclaw");
  if (!openclawPath) throw new Error("openclaw not found in PATH");
  return openclawPath;
}

export type RunOpenClawOptions = {
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
};

export async function runOpenClaw(
  openclawPath: string,
  args: string[],
  options?: RunOpenClawOptions | number,
): Promise<OpenClawExecResult> {
  const opts: RunOpenClawOptions =
    typeof options === "number" ? { timeoutMs: options } : (options ?? {});
  const baseEnv = opts.env ? { ...process.env, ...opts.env } : { ...process.env };
  baseEnv.PATH = buildEnrichedPath();
  const res = await execFileAsync(openclawPath, args, {
    timeout: opts.timeoutMs ?? 30_000,
    maxBuffer: 10 * 1024 * 1024,
    encoding: "utf8",
    env: baseEnv,
  });
  return {
    stdout: String(res.stdout ?? ""),
    stderr: String(res.stderr ?? ""),
  };
}

export async function runOpenClawJson<T>(
  openclawPath: string,
  args: string[],
  context: string,
  options?: RunOpenClawOptions | number,
): Promise<T> {
  const { stdout } = await runOpenClaw(openclawPath, args, options);
  return parseJson<T>(stdout, context);
}

/**
 * Build a PATH that includes well-known node directories so that
 * shebang-based scripts (`#!/usr/bin/env node`) can resolve `node`
 * even when the app is launched from Finder with a minimal PATH.
 */
function buildEnrichedPath(): string {
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

/**
 * Well-known directories where openclaw may be installed.
 * Used as fallback when login-shell PATH resolution fails
 * (common in packaged .app launched from Finder).
 */
const WELL_KNOWN_DIRS: readonly string[] =
  process.platform === "win32"
    ? []
    : [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        path.join(process.env.HOME ?? "", ".npm-global", "bin"),
        path.join(process.env.HOME ?? "", ".npm", "bin"),
        "/usr/bin",
      ];

/**
 * Scan all openclaw binaries in PATH and return their paths + versions.
 * Shared by InstallerService and RuntimeDetectorService.
 */
export async function scanAllOpenClawInstalls(): Promise<OpenClawInstall[]> {
  const installs: OpenClawInstall[] = [];

  let paths: string[] = [];
  try {
    const cmd = process.platform === "win32" ? "where openclaw" : "which -a openclaw";
    const { stdout } = await execInLoginShell(cmd, { timeoutMs: 5_000 });
    paths = stdout.trim().split(/\r?\n/).filter(Boolean);
  } catch {
    // which -a failed, try single resolve
    const single = await resolveCommandPath("openclaw");
    if (single) paths = [single];
  }

  // Fallback: probe well-known directories when login-shell scan finds nothing.
  if (paths.length === 0) {
    const binary = process.platform === "win32" ? "openclaw.exe" : "openclaw";
    for (const dir of WELL_KNOWN_DIRS) {
      const candidate = path.join(dir, binary);
      if (existsSync(candidate)) paths.push(candidate);
    }
  }

  const seen = new Set<string>();
  const enrichedEnv = { ...process.env, PATH: buildEnrichedPath() };
  for (const p of paths) {
    if (seen.has(p)) continue;
    seen.add(p);
    try {
      const { stdout: ver } = await safeExecFile(p, ["--version"], {
        timeoutMs: 5_000,
        env: enrichedEnv,
      });
      const version = ver.trim();
      if (version) installs.push({ path: p, version });
    } catch {
      // skip broken binaries
    }
  }

  return installs;
}
