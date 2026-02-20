/** Allowed OpenClaw config paths for the security IPC handler. */
export type AllowedConfigPath =
  | "tools.elevated.enabled"
  | "tools.elevated.allowFrom.webchat"
  | "tools.elevated.allowFrom.discord"
  | "tools.allow"
  | "tools.deny"
  | "agents.defaults.sandbox.mode"
  | "agents.defaults.sandbox.workspaceAccess"
  | "agents.defaults.sandbox.docker.binds";

export const ALLOWED_CONFIG_PATHS = new Set<AllowedConfigPath>([
  "tools.elevated.enabled",
  "tools.elevated.allowFrom.webchat",
  "tools.elevated.allowFrom.discord",
  "tools.allow",
  "tools.deny",
  "agents.defaults.sandbox.mode",
  "agents.defaults.sandbox.workspaceAccess",
  "agents.defaults.sandbox.docker.binds",
]);
