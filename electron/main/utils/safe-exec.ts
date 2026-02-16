import { execFile } from "node:child_process";
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
