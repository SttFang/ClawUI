import type { SkillEntry } from "@/lib/ipc";
import type { AgentsStoreState } from "./initialState";

const EMPTY_SKILLS: SkillEntry[] = [];

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
const selectSkillEntries = (s: AgentsStoreState) => s.skills?.skills ?? EMPTY_SKILLS;

// --- cron selectors ---
const selectCronStatus = (s: AgentsStoreState) => s.cronStatus;
const selectCronJobs = (s: AgentsStoreState) => s.cronJobs;
const selectCronError = (s: AgentsStoreState) => s.cronError;
const selectCronBusyJobId = (s: AgentsStoreState) => s.cronBusyJobId;
const selectCronRunsData = (s: AgentsStoreState) => s.cronRunsData;

// --- nodes selectors ---
const selectNodes = (s: AgentsStoreState) => s.nodes;
const selectPendingNodes = (s: AgentsStoreState) => s.pendingNodes;
const selectNodesError = (s: AgentsStoreState) => s.nodesError;
const selectNodesLoading = (s: AgentsStoreState) => s.nodesLoading;

export const agentsSelectors = {
  selectAgents,
  selectSelectedAgentId,
  selectSelectedAgent,
  selectConfig,
  selectConfigError,
  selectSkills,
  selectSkillsError,
  selectSkillEntries,
  selectCronStatus,
  selectCronJobs,
  selectCronError,
  selectCronBusyJobId,
  selectCronRunsData,
  selectNodes,
  selectPendingNodes,
  selectNodesError,
  selectNodesLoading,
};
