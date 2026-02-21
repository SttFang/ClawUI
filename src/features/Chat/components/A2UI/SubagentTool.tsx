import type { DynamicToolUIPart } from "ai";
import { Task, TaskContent, TaskTrigger, ScrollArea, cn } from "@clawui/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import type { SubagentHistoryMessage, SubagentNode, SubagentStatus } from "@/store/subagents";
import { toRecord } from "@/lib/exec";
import { useSubagentsStore, selectNodeByToolCallId, selectHistory } from "@/store/subagents";
import { SubagentMessageParts } from "./SubagentMessageParts";
import { useSubagentHistory } from "./useSubagentHistory";

const EMPTY_MESSAGES: SubagentHistoryMessage[] = [];

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

/** Extract childSessionKey + runId from a sessions_spawn tool output. */
function extractSpawnInfo(output: unknown): { childSessionKey: string; runId: string } | null {
  const unwrap = (raw: unknown): Record<string, unknown> | null => {
    if (!isRecord(raw)) return null;
    if (typeof raw.status === "string") return raw;
    // { content: [{ type: "text", text: JSON }] } wrapper
    const content = Array.isArray(raw.content) ? raw.content : null;
    if (!content) return null;
    for (const item of content) {
      if (isRecord(item) && item.type === "text" && typeof item.text === "string") {
        try {
          const parsed = JSON.parse(item.text);
          if (isRecord(parsed)) return parsed;
        } catch {
          /* not JSON */
        }
      }
    }
    return null;
  };

  const result = unwrap(output);
  if (!result) return null;
  const sk = typeof result.childSessionKey === "string" ? result.childSessionKey.trim() : "";
  const rid = typeof result.runId === "string" ? result.runId.trim() : "";
  return sk && rid ? { childSessionKey: sk, runId: rid } : null;
}

const STATUS_DOT: Record<SubagentStatus, string> = {
  spawning: "animate-pulse bg-blue-500",
  running: "animate-pulse bg-blue-500",
  done: "bg-emerald-500",
  error: "bg-destructive",
  timeout: "bg-amber-500",
};

function StatusDot({ status }: { status: SubagentStatus }) {
  return <span className={cn("inline-block size-1.5 shrink-0 rounded-full", STATUS_DOT[status])} />;
}

function extractTaskFromInput(input: unknown): string {
  const record = toRecord(input);
  if (!record) return "subagent";
  if (typeof record.task === "string" && record.task.trim()) return record.task.trim();
  if (typeof record.label === "string" && record.label.trim()) return record.label.trim();
  if (typeof record.prompt === "string" && record.prompt.trim()) {
    const p = record.prompt.trim();
    return p.length > 60 ? `${p.slice(0, 60)}…` : p;
  }
  return "subagent";
}

function useLiveDuration(createdAt: number | undefined, endedAt: number | undefined) {
  const [now, setNow] = useState(Date.now());
  const isActive = createdAt != null && endedAt == null;

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  if (createdAt == null) return undefined;
  const end = endedAt ?? now;
  return Math.max(0, Math.round((end - createdAt) / 1000));
}

function useNodeForToolCallId(toolCallId: string) {
  return useSubagentsStore(
    useShallow((state) => {
      const node = selectNodeByToolCallId(state, toolCallId);
      if (!node) return { node: null, messages: EMPTY_MESSAGES };
      return {
        node,
        messages: selectHistory(state, node.runId),
      };
    }),
  );
}

/** Infer subagent status from DynamicToolUIPart.state when no live node exists. */
function statusFromPartState(state: DynamicToolUIPart["state"]): SubagentStatus {
  if (state === "output-available") return "done";
  if (state === "output-error") return "error";
  return "spawning";
}

export function SubagentTool(props: { part: DynamicToolUIPart; sessionKey: string }) {
  const { part, sessionKey } = props;
  const { t } = useTranslation("common");
  const { node, messages } = useNodeForToolCallId(part.toolCallId);

  const status: SubagentStatus = node?.status ?? statusFromPartState(part.state);
  const isActive = status === "running" || status === "spawning";
  const taskName = node?.task ?? extractTaskFromInput(part.input);
  const duration = useLiveDuration(node?.createdAt, node?.endedAt);

  // When no node exists (historical session), hydrate store from part.output
  // so useSubagentHistory can fetch the child session's history.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (node || hydratedRef.current) return;
    const info = extractSpawnInfo(part.output);
    if (!info) return;
    hydratedRef.current = true;
    const hydrated: SubagentNode = {
      runId: info.runId,
      toolCallId: part.toolCallId,
      sessionKey: info.childSessionKey,
      parentSessionKey: sessionKey,
      task: extractTaskFromInput(part.input),
      status: statusFromPartState(part.state),
      createdAt: Date.now(),
      endedAt: status === "done" || status === "error" ? Date.now() : undefined,
    };
    useSubagentsStore.getState().add(hydrated);
  }, [node, part.output, part.toolCallId, part.input, part.state, sessionKey, status]);

  useSubagentHistory(node?.runId ?? null, node?.sessionKey ?? null, status);

  const [open, setOpen] = useState(isActive);
  const prevActive = useRef(isActive);
  useEffect(() => {
    if (isActive !== prevActive.current) {
      setOpen(isActive);
      prevActive.current = isActive;
    }
  }, [isActive]);

  const durationLabel = duration != null ? `${duration}s` : "";

  const flatParts = useMemo(() => {
    const parts = messages
      .filter((m) => m.role === "assistant" || m.role === "toolResult")
      .flatMap((m) => m.parts);
    return parts.length > 0 ? parts : null;
  }, [messages]);

  return (
    <Task open={open} onOpenChange={setOpen}>
      <TaskTrigger title={taskName}>
        <div className="flex w-full cursor-pointer items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <StatusDot status={status} />
          <p className="min-w-0 flex-1 truncate text-foreground/90">{taskName}</p>
          {node?.model && (
            <span className="shrink-0 rounded border border-border/50 bg-muted px-1 py-0.5 font-mono text-[9px] text-muted-foreground">
              {node.model}
            </span>
          )}
          {durationLabel && (
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
              {durationLabel}
            </span>
          )}
        </div>
      </TaskTrigger>
      <TaskContent>
        <ScrollArea className="max-h-80">
          <div className="space-y-2">
            {flatParts == null ? (
              <p className="text-xs text-muted-foreground">
                {isActive ? t("subagent.loading") : t("subagent.noOutput")}
              </p>
            ) : (
              <SubagentMessageParts parts={flatParts} />
            )}
            {node?.error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                {node.error}
              </div>
            )}
          </div>
        </ScrollArea>
      </TaskContent>
    </Task>
  );
}
