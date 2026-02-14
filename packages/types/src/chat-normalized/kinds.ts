export type ChatNormalizedRunEventKind =
  | "run.started"
  | "run.waiting_approval"
  | "run.approval_resolved"
  | "run.running"
  | "run.delta"
  | "run.tool_started"
  | "run.tool_updated"
  | "run.tool_finished"
  | "run.lifecycle"
  | "run.completed"
  | "run.failed"
  | "run.aborted"
  | "run.degraded_recovered";
