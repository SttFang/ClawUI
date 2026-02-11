import type { Tool, ToolAccessMode, ToolsConfig } from "./types";

type JsonObject = Record<string, unknown>;

export function asRecord(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonObject;
}

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function deriveToolAccessMode(tools: JsonObject | null): ToolAccessMode {
  if (!tools) return "auto";
  const deny = toStringArray(tools.deny);
  if (deny.includes("*")) return "deny";
  const exec = asRecord(tools.exec);
  const ask = readString(exec?.ask);
  if (ask === "always") return "ask";
  return "auto";
}

export function deriveSandboxEnabled(root: JsonObject): boolean {
  const agents = asRecord(root.agents);
  const defaults = asRecord(agents?.defaults);
  const sandbox = asRecord(defaults?.sandbox);
  if (!sandbox) return false;
  if (typeof sandbox.enabled === "boolean") return sandbox.enabled;
  const mode = readString(sandbox.mode);
  return mode ? mode !== "off" : false;
}

export function applyEnabledToTools(tools: Tool[], config: ToolsConfig): Tool[] {
  return tools.map((tool) => ({
    ...tool,
    enabled: config.denyList.includes(tool.id)
      ? false
      : config.allowList.includes(tool.id) || tool.enabled,
  }));
}

export function buildToolsPersistPatch(config: ToolsConfig): JsonObject {
  const exec: JsonObject = {};
  if (config.accessMode === "auto") {
    exec.ask = "on-miss";
    exec.security = undefined;
  } else if (config.accessMode === "ask") {
    exec.ask = "always";
    exec.security = undefined;
  } else {
    exec.ask = "off";
    exec.security = "deny";
  }

  return {
    tools: {
      allow: config.allowList,
      deny: config.denyList,
      exec,
    },
    agents: {
      defaults: {
        sandbox: {
          mode: config.sandboxEnabled ? "non-main" : "off",
        },
      },
    },
  };
}
