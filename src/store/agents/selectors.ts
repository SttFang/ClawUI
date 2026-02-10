import { createWeakCachedSelector } from "@/store/utils/createWeakCachedSelector";
import type { AgentsStoreState } from "./initialState";

// --- crud selectors ---
const selectAgents = (s: AgentsStoreState) => s.agents;
const selectSelectedAgentId = (s: AgentsStoreState) => s.selectedAgentId;
const selectSelectedAgent = (s: AgentsStoreState) =>
  s.agents.find((a) => a.id === s.selectedAgentId) ?? s.agents[0] ?? null;

// --- config selectors ---
const selectConfig = (s: AgentsStoreState) => s.config;
const selectConfigError = (s: AgentsStoreState) => s.configError;
const selectSkills = (s: AgentsStoreState) => s.skills;
const selectSkillsError = (s: AgentsStoreState) => s.skillsError;
const selectSkillsMain = createWeakCachedSelector(
  (s: AgentsStoreState) => s.skills?.profiles?.main ?? null,
);
const selectSkillsConfigAgent = createWeakCachedSelector(
  (s: AgentsStoreState) => s.skills?.profiles?.configAgent ?? null,
);

// --- cron selectors ---
const selectCronStatus = (s: AgentsStoreState) => s.cronStatus;
const selectCronJobs = (s: AgentsStoreState) => s.cronJobs;
const selectCronError = (s: AgentsStoreState) => s.cronError;
const selectCronBusyJobId = (s: AgentsStoreState) => s.cronBusyJobId;
const selectCronRunsData = (s: AgentsStoreState) => s.cronRunsData;

export const agentsSelectors = {
  selectAgents,
  selectSelectedAgentId,
  selectSelectedAgent,
  selectConfig,
  selectConfigError,
  selectSkills,
  selectSkillsError,
  selectSkillsMain,
  selectSkillsConfigAgent,
  selectCronStatus,
  selectCronJobs,
  selectCronError,
  selectCronBusyJobId,
  selectCronRunsData,
};
