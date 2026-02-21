/** Allowed ACP methods for the main chat:request IPC handler. */
export const ALLOWED_CHAT_METHODS = new Set([
  // Sessions
  "sessions.list",
  "sessions.patch",
  "sessions.reset",
  "sessions.delete",
  "sessions.kill",
  // Chat
  "chat.history",
  "chat.abort",
  // Agent
  "agent.wait",
  // Models
  "models.list",
  // Exec approvals
  "exec.approvals.get",
  "exec.approvals.set",
  "exec.approval.resolve",
  // Cron
  "cron.status",
  "cron.list",
  "cron.update",
  "cron.run",
  "cron.remove",
  "cron.runs",
  // Nodes
  "node.list",
  "node.pair.list",
  "node.pair.approve",
  "node.pair.reject",
  // Skills
  "skills.status",
  "skills.update",
  "skills.install",
  "skills.uninstall",
]);

/** Allowed ACP methods for the rescue:request IPC handler. */
export const ALLOWED_RESCUE_METHODS = new Set([
  "sessions.list",
  "sessions.patch",
  "sessions.reset",
  "sessions.delete",
  "chat.history",
  "chat.abort",
  "models.list",
]);
