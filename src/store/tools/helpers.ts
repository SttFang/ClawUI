import type {
  ExecAskMode,
  ExecHostMode,
  ExecSecurityMode,
  Tool,
  ToolAccessMode,
  ToolsConfig,
} from "./types";

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

function asExecHost(value: unknown): ExecHostMode | null {
  if (value === "sandbox" || value === "gateway" || value === "node") return value;
  return null;
}

function asExecAsk(value: unknown): ExecAskMode | null {
  if (value === "off" || value === "on-miss" || value === "always") return value;
  return null;
}

function asExecSecurity(value: unknown): ExecSecurityMode | null {
  if (value === "deny" || value === "allowlist" || value === "full") return value;
  return null;
}

export function deriveExecHostMode(tools: JsonObject | null): ExecHostMode {
  const exec = asRecord(tools?.exec);
  return asExecHost(exec?.host) ?? "sandbox";
}

/** Sandbox host bypasses approval checks; normalize to gateway when sandbox is off. */
export function normalizeExecHost(host: ExecHostMode, sandboxEnabled: boolean): ExecHostMode {
  return host === "sandbox" && !sandboxEnabled ? "gateway" : host;
}

export function deriveExecAskMode(tools: JsonObject | null): ExecAskMode {
  const exec = asRecord(tools?.exec);
  return asExecAsk(exec?.ask) ?? "on-miss";
}

export function deriveExecSecurityMode(
  tools: JsonObject | null,
  host: ExecHostMode,
): ExecSecurityMode {
  const exec = asRecord(tools?.exec);
  const configured = asExecSecurity(exec?.security);
  if (configured) return configured;
  return host === "sandbox" ? "deny" : "allowlist";
}

export function deriveToolAccessMode(params: {
  tools: JsonObject | null;
  execAsk: ExecAskMode;
  execSecurity: ExecSecurityMode;
}): ToolAccessMode {
  const deny = toStringArray(params.tools?.deny);
  if (deny.includes("*")) return "deny";
  if (params.execAsk === "always") return "ask";
  if (params.execAsk === "off" && params.execSecurity === "deny") return "deny";
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
  return {
    tools: {
      allow: config.allowList,
      deny: config.denyList,
      exec: {
        host: config.execHost,
        ask: config.execAsk,
        security: config.execSecurity,
      },
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
