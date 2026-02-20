/** Gateway events tracked in the activity store. */
export const TRACKED_GATEWAY_EVENTS = new Set([
  "heartbeat",
  "health",
  "shutdown",
  "exec.approval.requested",
  "exec.approval.resolved",
  "cron",
]);
