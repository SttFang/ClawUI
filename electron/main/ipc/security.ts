import type { IpcMain } from "electron";
import { ALLOWED_CONFIG_PATHS, type AllowedConfigPath } from "@clawui/constants";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveOpenClawPath } from "../utils/openclaw-cli";

const execFileAsync = promisify(execFile);

function assertAllowedPath(path: string): asserts path is AllowedConfigPath {
  if (!ALLOWED_CONFIG_PATHS.has(path as AllowedConfigPath)) {
    throw new Error(`Config path not allowed: ${path}`);
  }
}

export interface SecurityOp {
  path: string;
  value: unknown;
}

export function registerSecurityHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("security:get", async (_, paths: string[]): Promise<Record<string, unknown>> => {
    if (!Array.isArray(paths)) throw new Error("paths must be an array");
    const openclawPath = await resolveOpenClawPath();

    const out: Record<string, unknown> = {};
    for (const p of paths) {
      if (typeof p !== "string") continue;
      assertAllowedPath(p);
      const res = await execFileAsync(openclawPath, ["config", "get", "--json", p], {
        timeout: 30_000,
        maxBuffer: 2 * 1024 * 1024,
        encoding: "utf8",
      });
      const raw = String(res.stdout ?? "").trim();
      out[p] = raw ? JSON.parse(raw) : null;
    }
    return out;
  });

  ipcMain.handle("security:apply", async (_, ops: SecurityOp[]): Promise<void> => {
    if (!Array.isArray(ops)) throw new Error("ops must be an array");
    const openclawPath = await resolveOpenClawPath();

    for (const op of ops) {
      if (!op || typeof op !== "object") continue;
      const path = (op as { path?: unknown }).path;
      if (typeof path !== "string") continue;
      assertAllowedPath(path);

      const value = (op as { value?: unknown }).value;
      const jsonValue = JSON.stringify(value);

      await execFileAsync(openclawPath, ["config", "set", "--json", path, jsonValue], {
        timeout: 60_000,
        maxBuffer: 2 * 1024 * 1024,
        encoding: "utf8",
      });
    }
  });
}
