import { IpcMain } from "electron";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { mainLog } from "../lib/logger";
import { resolveOpenClawPath, runOpenClawJson } from "../utils/openclaw-cli";

export type SkillEntry = {
  name: string;
  description: string;
  source: string;
};

export type SkillsListResult = {
  skills: SkillEntry[];
};

type CLISkillEntry = {
  name: string;
  description?: string;
  source?: string;
  eligible?: boolean;
};

type CLIReport = { skills: CLISkillEntry[] };

function stripExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx <= 0) return name;
  return name.slice(0, idx);
}

async function listSkillsUnder(dir: string, source: string): Promise<SkillEntry[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => !e.name.startsWith("."))
      .map((e) => ({
        name: e.isFile() ? stripExtension(e.name) : e.name,
        description: "",
        source,
      }))
      .filter((s) => s.name.trim().length > 0);
  } catch {
    return [];
  }
}

async function fallbackScan(): Promise<SkillEntry[]> {
  const home = homedir();
  const dirs: [string, string][] = [
    [join(home, ".openclaw", "skills"), "openclaw"],
    [join(home, ".agents", "skills"), "agents"],
    [join(home, ".claude", "skills"), "claude"],
  ];
  const results = await Promise.all(dirs.map(([d, s]) => listSkillsUnder(d, s)));
  const seen = new Set<string>();
  const deduped: SkillEntry[] = [];
  for (const list of results) {
    for (const entry of list) {
      if (!seen.has(entry.name)) {
        seen.add(entry.name);
        deduped.push(entry);
      }
    }
  }
  deduped.sort((a, b) => a.name.localeCompare(b.name));
  return deduped;
}

export function registerSkillsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("skills:list", async (): Promise<SkillsListResult> => {
    try {
      const openclawPath = await resolveOpenClawPath();
      const report = await runOpenClawJson<CLIReport>(
        openclawPath,
        ["skills", "list", "--json", "--eligible"],
        "skills list",
      );
      const skills: SkillEntry[] = (report.skills ?? []).map((s) => ({
        name: s.name,
        description: s.description ?? "",
        source: s.source ?? "",
      }));
      mainLog.info("[skills.list] loaded via CLI", { count: skills.length });
      return { skills };
    } catch (e) {
      mainLog.warn("[skills.list] CLI failed, falling back to dir scan", {
        error: e instanceof Error ? e.message : String(e),
      });
      const skills = await fallbackScan();
      mainLog.info("[skills.list] loaded via fallback", { count: skills.length });
      return { skills };
    }
  });
}
