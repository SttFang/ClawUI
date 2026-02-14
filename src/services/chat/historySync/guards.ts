import type { UIMessage } from "ai";
import type { ChatNormalizedRunEvent } from "@/lib/ipc";

const MIN_PREV_MESSAGES_FOR_DROP_GUARD = 6;
const DROP_GUARD_MIN_DELTA = 4;
const DROP_GUARD_RATIO_THRESHOLD = 0.6;

export function isExecToolFinished(event: ChatNormalizedRunEvent): boolean {
  if (event.kind !== "run.tool_finished") return false;
  const metadata =
    event.metadata && typeof event.metadata === "object"
      ? (event.metadata as Record<string, unknown>)
      : null;
  const toolName = typeof metadata?.name === "string" ? metadata.name.trim().toLowerCase() : "";
  return toolName === "" || toolName === "exec" || toolName === "bash";
}

export function getLifecyclePhase(event: ChatNormalizedRunEvent): string {
  if (event.kind !== "run.lifecycle") return "";
  if (!event.metadata || typeof event.metadata !== "object") return "";
  const phase = (event.metadata as Record<string, unknown>).phase;
  return typeof phase === "string" ? phase : "";
}

export function isTerminalLifecycleEvent(event: ChatNormalizedRunEvent): boolean {
  const phase = getLifecyclePhase(event);
  return phase === "end" || phase === "error";
}

export function hasRecentTailOverlap(previous: UIMessage[], next: UIMessage[]): boolean {
  const tailIds = previous
    .slice(-3)
    .map((message) => message.id)
    .filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  if (tailIds.length === 0) return true;
  const nextIds = new Set(next.map((message) => message.id));
  return tailIds.some((id) => nextIds.has(id));
}

export function isLikelyTransientHistoryDrop(previous: UIMessage[], next: UIMessage[]): boolean {
  if (previous.length < MIN_PREV_MESSAGES_FOR_DROP_GUARD) return false;
  if (next.length >= previous.length) return false;
  if (next.length === 0) return true;

  const delta = previous.length - next.length;
  if (delta < DROP_GUARD_MIN_DELTA) return false;
  if (next.length / previous.length > DROP_GUARD_RATIO_THRESHOLD) return false;

  return !hasRecentTailOverlap(previous, next);
}

export function shouldRefreshOnNormalizedEvent(event: ChatNormalizedRunEvent): boolean {
  return (
    event.kind === "run.completed" ||
    event.kind === "run.failed" ||
    event.kind === "run.aborted" ||
    isTerminalLifecycleEvent(event) ||
    event.kind === "run.approval_resolved" ||
    event.kind === "run.waiting_approval" ||
    event.kind === "run.tool_finished"
  );
}

export function shouldForceRefreshOnNormalizedEvent(event: ChatNormalizedRunEvent): boolean {
  return (
    event.kind === "run.completed" ||
    event.kind === "run.failed" ||
    event.kind === "run.aborted" ||
    isTerminalLifecycleEvent(event) ||
    event.kind === "run.approval_resolved"
  );
}

export function shouldClearRunningOnNormalizedEvent(event: ChatNormalizedRunEvent): boolean {
  return (
    event.kind === "run.completed" ||
    event.kind === "run.failed" ||
    event.kind === "run.aborted" ||
    isTerminalLifecycleEvent(event) ||
    isExecToolFinished(event)
  );
}
