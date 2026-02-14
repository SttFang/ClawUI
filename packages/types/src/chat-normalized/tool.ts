export type ToolPhase = "start" | "update" | "result" | "end" | "error";

export type KnownToolName =
  | "read"
  | "write"
  | "edit"
  | "exec"
  | "process"
  | "apply_patch"
  | "browser"
  | "canvas"
  | "nodes"
  | "cron"
  | "message"
  | "tts"
  | "gateway"
  | "agents_list"
  | "sessions_list"
  | "sessions_history"
  | "sessions_send"
  | "sessions_spawn"
  | "session_status"
  | "web_search"
  | "web_fetch"
  | "image"
  | "memory_search"
  | "memory_get";

export type ToolName = KnownToolName | (string & {});

export interface NormalizedToolEventMetadata {
  name: ToolName;
  phase?: ToolPhase;
  toolCallId?: string;
  args?: unknown;
  result?: unknown;
  partialResult?: unknown;
  isError?: boolean;
  meta?: unknown;
}
