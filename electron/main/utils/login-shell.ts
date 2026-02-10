import { execFile } from "child_process";
import { existsSync } from "fs";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface ExecInLoginShellOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

function resolveShellBinary(): string {
  const envShell = process.env.SHELL;
  if (envShell && existsSync(envShell)) return envShell;

  if (process.platform === "darwin" && existsSync("/bin/zsh")) return "/bin/zsh";
  if (existsSync("/bin/bash")) return "/bin/bash";
  if (existsSync("/bin/sh")) return "/bin/sh";
  return "sh";
}

export function buildLoginShellInvocation(command: string): {
  file: string;
  args: string[];
} {
  if (process.platform === "win32") {
    // /d: disable AutoRun, /s: quote rules, /c: run then exit
    return { file: "cmd.exe", args: ["/d", "/s", "/c", command] };
  }

  const shell = resolveShellBinary();
  return { file: shell, args: ["-lc", command] };
}

export async function execInLoginShell(
  command: string,
  options: ExecInLoginShellOptions = {},
): Promise<{ stdout: string; stderr: string }> {
  const { file, args } = buildLoginShellInvocation(command);

  const res = await execFileAsync(file, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    timeout: options.timeoutMs ?? 60_000,
    maxBuffer: 10 * 1024 * 1024,
    encoding: "utf8",
  });

  return {
    stdout: String(res.stdout ?? ""),
    stderr: String(res.stderr ?? ""),
  };
}

export async function resolveCommandPath(commandName: string): Promise<string | null> {
  // Protect against injection since we pass a shell string.
  if (!/^[a-zA-Z0-9._-]+$/.test(commandName)) {
    throw new Error(`Invalid command name: ${commandName}`);
  }

  try {
    if (process.platform === "win32") {
      const { stdout } = await execInLoginShell(`where ${commandName}`, {
        timeoutMs: 5_000,
      });
      return stdout.trim().split(/\r?\n/)[0] || null;
    }

    const { stdout } = await execInLoginShell(`command -v ${commandName}`, {
      timeoutMs: 5_000,
    });
    const out = stdout.trim().split("\n").filter(Boolean);
    return out[out.length - 1] || null;
  } catch {
    return null;
  }
}
