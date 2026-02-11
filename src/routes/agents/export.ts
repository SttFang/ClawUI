import type { SkillsListResult } from "@/lib/ipc";
import type { OpenClawConfig } from "@/lib/ipc";

export type AgentsExportOperation =
  | { id: string; kind: "rpc"; method: string; params?: Record<string, unknown> }
  | { id: string; kind: "navigate"; href: string };

export type AgentsExportPayload = {
  schemaVersion: 1;
  exportedAt: string;
  agent: {
    id: string;
    modelPrimary: string | null;
    modelFallbacks: string[];
    workspace: string | null;
  } | null;
  inputs: {
    channels: {
      configured: number;
      enabled: number;
      items: Array<{
        type: string;
        name: string;
        configured: boolean;
        enabled: boolean;
      }>;
    };
  };
  capabilities: {
    tools: {
      accessMode: string;
      sandboxEnabled: boolean;
      enabledTools: string[];
    };
  };
  extensions: {
    pluginsInstalled: Array<{ id: string; name: string; version: string }>;
    mcpServers: Array<{
      id: string;
      name: string;
      command: string;
      args: string[];
      enabled: boolean;
    }>;
  };
  skills: SkillsListResult | null;
  cron: {
    status: unknown;
    jobs: unknown;
  };
  operations: AgentsExportOperation[];
  notes: {
    openclawConfigPath?: string;
  };
};

export function buildAgentsExportPayload(params: {
  exportedAt: string;
  agent: AgentsExportPayload["agent"];
  channels: AgentsExportPayload["inputs"]["channels"];
  tools: AgentsExportPayload["capabilities"]["tools"];
  pluginsInstalled: AgentsExportPayload["extensions"]["pluginsInstalled"];
  mcpServers: AgentsExportPayload["extensions"]["mcpServers"];
  skills: SkillsListResult | null;
  cronStatus: unknown;
  cronJobs: unknown;
  config: OpenClawConfig | null;
}): AgentsExportPayload {
  const ops: AgentsExportOperation[] = [
    { id: "skills.list", kind: "rpc", method: "skills:list" },
    { id: "cron.status", kind: "rpc", method: "cron.status", params: {} },
    { id: "cron.list", kind: "rpc", method: "cron.list", params: { includeDisabled: true } },
    {
      id: "cron.update",
      kind: "rpc",
      method: "cron.update",
      params: { id: "<jobId>", patch: { enabled: true } },
    },
    { id: "cron.run", kind: "rpc", method: "cron.run", params: { id: "<jobId>", mode: "force" } },
    { id: "cron.remove", kind: "rpc", method: "cron.remove", params: { id: "<jobId>" } },
    { id: "cron.runs", kind: "rpc", method: "cron.runs", params: { id: "<jobId>", limit: 50 } },
    {
      id: "navigate.plugins",
      kind: "navigate",
      href: "#/settings?tab=config&section=plugins",
    },
    { id: "navigate.skills", kind: "navigate", href: "#/settings?tab=config&section=skills" },
    {
      id: "navigate.channels",
      kind: "navigate",
      href: "#/settings?tab=config&section=channels",
    },
    { id: "navigate.tools", kind: "navigate", href: "#/settings?tab=config&section=tools" },
  ];

  return {
    schemaVersion: 1,
    exportedAt: params.exportedAt,
    agent: params.agent,
    inputs: { channels: params.channels },
    capabilities: { tools: params.tools },
    extensions: { pluginsInstalled: params.pluginsInstalled, mcpServers: params.mcpServers },
    skills: params.skills,
    cron: { status: params.cronStatus, jobs: params.cronJobs },
    operations: ops,
    notes: {
      openclawConfigPath: (params.config as { _meta?: { path?: string } } | null)?._meta?.path,
    },
  };
}
