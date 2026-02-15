import type { IpcMain } from "electron";
import { execFile } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, join } from "node:path";
import type { ConfigService } from "../services/config";

type WorkspaceFileEntry = {
  name: string;
  isDirectory: boolean;
  size: number;
  updatedAtMs: number;
};

function resolveWorkspaceDir(
  config: { agents?: { defaults?: { workspace?: string } } } | null,
): string {
  const raw = config?.agents?.defaults?.workspace ?? "~/.openclaw/workspace";
  return raw.startsWith("~") ? join(homedir(), raw.slice(1)) : raw;
}

export function registerWorkspaceHandlers(ipcMain: IpcMain, configService: ConfigService): void {
  ipcMain.handle("workspace:list", async (_event, subpath?: string) => {
    const config = await configService.getConfig();
    const base = resolveWorkspaceDir(config);
    const dir = subpath ? join(base, subpath) : base;

    const entries = await readdir(dir, { withFileTypes: true });
    const files: WorkspaceFileEntry[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = join(dir, entry.name);
      const st = await stat(fullPath).catch(() => null);
      if (!st) continue;
      files.push({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        size: st.size,
        updatedAtMs: Math.floor(st.mtimeMs),
      });
    }
    return { dir, files };
  });

  ipcMain.handle("workspace:read-file", async (_event, relativePath: string) => {
    const config = await configService.getConfig();
    const base = resolveWorkspaceDir(config);
    const filePath = join(base, relativePath);

    // Prevent path traversal
    if (!filePath.startsWith(base)) {
      throw new Error("Path traversal not allowed");
    }

    const content = await readFile(filePath, "utf-8");
    return { path: filePath, content };
  });

  ipcMain.handle("workspace:read-file-base64", async (_event, relativePath: string) => {
    const config = await configService.getConfig();
    const base = resolveWorkspaceDir(config);
    const filePath = join(base, relativePath);

    if (!filePath.startsWith(base)) {
      throw new Error("Path traversal not allowed");
    }

    const buf = await readFile(filePath);
    return { path: filePath, base64: buf.toString("base64") };
  });

  ipcMain.handle("workspace:run-python", async (_event, relativePath: string) => {
    const config = await configService.getConfig();
    const base = resolveWorkspaceDir(config);
    const filePath = join(base, relativePath);

    if (!filePath.startsWith(base)) {
      throw new Error("Path traversal not allowed");
    }
    if (extname(filePath) !== ".py") {
      throw new Error("Only .py files are allowed");
    }

    return new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
      execFile(
        "python3",
        [filePath],
        { cwd: base, timeout: 30_000, maxBuffer: 1024 * 1024 },
        (error, stdout, stderr) => {
          const code = error?.code;
          resolve({
            stdout,
            stderr,
            exitCode: typeof code === "number" ? code : error ? 1 : 0,
          });
        },
      );
    });
  });
}
