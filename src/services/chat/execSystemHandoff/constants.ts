export const HISTORY_LIMIT = 1_000;
export const HANDOFF_REFRESH_DELAY_MS = 80;
export const HANDOFF_COOLDOWN_MS = 120_000;
export const EXEC_TOOL_FALLBACK = "No output - tool completed successfully.";
export const INTERNAL_SYSTEM_KIND = "internal_system";
export const TOOL_NAMES = new Set(["exec", "bash"]);
export const APPROVAL_DECISIONS = new Set(["allow-once", "allow-always", "deny", "timeout"]);
