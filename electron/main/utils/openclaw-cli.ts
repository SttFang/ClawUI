import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveCommandPath } from "./login-shell";

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
  const res = await execFileAsync(openclawPath, args, {
    timeout: opts.timeoutMs ?? 30_000,
    maxBuffer: 10 * 1024 * 1024,
    encoding: "utf8",
    env: opts.env ? { ...process.env, ...opts.env } : { ...process.env },
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
