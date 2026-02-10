import type { OpenClawConfig, SkillsListResult } from "@/lib/ipc";

export interface ConfigState {
  config: OpenClawConfig | null;
  skills: SkillsListResult | null;
  configError: string | null;
  skillsError: string | null;
}

export const initialConfigState: ConfigState = {
  config: null,
  skills: null,
  configError: null,
  skillsError: null,
};
