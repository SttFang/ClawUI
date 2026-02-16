import { IpcMain } from "electron";
import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { OpenClawProfileId, OpenClawProfilesService } from "../services/openclaw-profiles";

type SkillsProfileList = {
  dir: string;
  skills: string[];
};

export type SkillsListResult = {
  profiles: Record<OpenClawProfileId, SkillsProfileList>;
};

function stripExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx <= 0) return name;
  return name.slice(0, idx);
}

async function listSkillsUnder(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const names = entries
      .filter((e) => !e.name.startsWith("."))
      .map((e) => (e.isFile() ? stripExtension(e.name) : e.name))
      .filter((n) => n.trim().length > 0);
    names.sort((a, b) => a.localeCompare(b));
    return names;
  } catch {
    return [];
  }
}

function resolveSkillsDir(profiles: OpenClawProfilesService, profileId: OpenClawProfileId): string {
  const cfgPath = profiles.getConfigPath(profileId);
  return join(dirname(cfgPath), "skills");
}

export function registerSkillsHandlers(
  ipcMain: IpcMain,
  profilesService: OpenClawProfilesService,
): void {
  ipcMain.handle("skills:list", async (): Promise<SkillsListResult> => {
    const mainDir = resolveSkillsDir(profilesService, "main");
    const configAgentDir = resolveSkillsDir(profilesService, "configAgent");

    const [main, configAgent] = await Promise.all([
      listSkillsUnder(mainDir),
      listSkillsUnder(configAgentDir),
    ]);

    return {
      profiles: {
        main: { dir: mainDir, skills: main },
        configAgent: { dir: configAgentDir, skills: configAgent },
      },
    };
  });
}
