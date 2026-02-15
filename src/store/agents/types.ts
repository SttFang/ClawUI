import type { CronSchedule } from "@/routes/agents/cronFormat";

export type Agent = {
  id: string;
  modelPrimary: string | null;
  modelFallbacks: string[];
  workspace: string | null;
};

export type CronStatus = {
  enabled: boolean;
  jobs: number;
  nextWakeAtMs?: number | null;
  storePath?: string;
};

export type CronJob = {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: CronSchedule;
  sessionTarget: "main" | "isolated";
  wakeMode: "now" | "next-heartbeat";
  payload: unknown;
  delivery?: unknown;
  state?: {
    nextRunAtMs?: number;
    runningAtMs?: number;
    lastRunAtMs?: number;
    lastStatus?: "ok" | "error" | "skipped";
    lastError?: string;
    lastDurationMs?: number;
  };
};

export type CronRunsEntry = {
  ts: number;
  jobId: string;
  status: "ok" | "error" | "skipped";
  durationMs?: number;
  error?: string;
  summary?: string;
  sessionId?: string;
  sessionKey?: string;
};

export type NodeInfo = {
  nodeId: string;
  displayName?: string;
  platform?: string;
  version?: string;
  caps?: string[];
  connected?: boolean;
  paired?: boolean;
};

export type PendingNode = {
  requestId: string;
  displayName?: string;
  platform?: string;
  expiresAtMs?: number;
};
