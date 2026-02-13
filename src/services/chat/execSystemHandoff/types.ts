export type HandOffSource =
  | "agent-tool-terminal"
  | "approval-allow"
  | "approval-deny"
  | "approval-timeout"
  | "approval-unknown";

export type HandOffPayload = {
  sessionKey: string;
  runId?: string;
  source: HandOffSource;
  text?: string;
  retryCount?: number;
};
