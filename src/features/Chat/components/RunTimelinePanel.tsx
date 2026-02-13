import { Task, TaskContent, TaskItem, TaskTrigger } from "@clawui/ui";
import type { TimelineEvent } from "@clawui/types/run-map";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRunMapStore } from "@/store/runMap";

function isTerminalStatus(status: string): boolean {
  return status === "completed" || status === "failed" || status === "aborted";
}

function isToolNoiseEvent(kind: string): boolean {
  return kind === "run.tool_started" || kind === "run.tool_updated" || kind === "run.tool_finished";
}

function signatureOfTimelineEvent(event: TimelineEvent): string {
  return [
    event.kind,
    event.runId ?? "no-run",
    event.approvalId ?? "no-approval",
    event.toolCallId ?? "no-tool",
    event.atMs,
  ].join("|");
}

function formatClock(atMs: number): string {
  try {
    return new Date(atMs).toLocaleTimeString();
  } catch {
    return String(atMs);
  }
}

function runTypeLabel(type: "chat" | "approval" | "agent" | "system"): string {
  if (type === "chat") return "chat";
  if (type === "approval") return "approval";
  if (type === "agent") return "agent";
  return "system";
}

function selectRunTimelineEvents(
  params: {
    timeline: TimelineEvent[];
    runId: string;
    approvalIds: string[];
    toolCallIds: string[];
  },
) {
  const approvalIdSet = new Set(params.approvalIds);
  const toolCallIdSet = new Set(params.toolCallIds);
  const seen = new Set<string>();

  return params.timeline
    .filter((evt) => {
      if (evt.runId === params.runId) return true;
      if (evt.approvalId) return approvalIdSet.has(evt.approvalId);
      return false;
    })
    .filter((evt) => !isToolNoiseEvent(evt.kind))
    .filter((evt) => evt.toolCallId === undefined || !toolCallIdSet.has(evt.toolCallId))
    .sort((a, b) => a.atMs - b.atMs)
    .filter((evt) => {
      const sig = signatureOfTimelineEvent(evt);
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    })
    .slice(-8);
}

export function RunTimelinePanel(props: { sessionKey: string }) {
  const { sessionKey } = props;
  const { t } = useTranslation("common");
  const session = useRunMapStore((state) => state.sessions[sessionKey]);

  const runs = useMemo(() => {
    if (!session) return [];
    return Object.values(session.runsById)
      .filter((run) => !isTerminalStatus(run.status))
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }, [session]);

  if (!session || runs.length === 0) return null;

  return (
    <div className="mx-auto mb-3 w-full max-w-3xl rounded-xl border border-border/70 bg-card/60 p-3">
      <div className="mb-2 text-xs text-muted-foreground">RunIdMap</div>
      <div className="space-y-3">
        {runs.map((run) => {
          const approvalIds = session.indexes.approvalIdsByRunId[run.runId] ?? [];
          const toolCallIds = session.indexes.toolCallIdsByRunId[run.runId] ?? [];
          const timeline = selectRunTimelineEvents({
            timeline: session.timeline,
            runId: run.runId,
            approvalIds,
            toolCallIds,
          });

          if (timeline.length === 0 && approvalIds.length === 0 && toolCallIds.length === 0) {
            return null;
          }

          const pendingApprovals = approvalIds.filter((approvalId) => {
            const approval = session.approvalsById[approvalId];
            return approval?.status === "pending";
          });
          const runningTools = toolCallIds.filter((toolCallId) => {
            const tool = session.toolCallsById[toolCallId];
            return tool?.status === "running";
          });

          return (
            <Task key={run.runId} defaultOpen={run.runId === session.rootChatRunId}>
              <TaskTrigger
                title={`${runTypeLabel(run.type)} · ${t("a2ui.run", { runId: run.runId })}`}
              />
              <TaskContent>
                <TaskItem className="text-xs">
                  status: {run.status} · source: {run.source}
                </TaskItem>
                {run.agentRunId && run.agentRunId !== run.runId ? (
                  <TaskItem className="text-xs text-muted-foreground">
                    agentRunId: {run.agentRunId}
                  </TaskItem>
                ) : null}
                {approvalIds.length > 0 ? (
                  <TaskItem className="text-xs text-muted-foreground">
                    approvals: {pendingApprovals.length}/{approvalIds.length} pending
                  </TaskItem>
                ) : null}
                {toolCallIds.length > 0 ? (
                  <TaskItem className="text-xs text-muted-foreground">
                    tools: {runningTools.length}/{toolCallIds.length} running
                  </TaskItem>
                ) : null}
                {timeline.map((evt) => (
                  <TaskItem key={evt.id} className="text-xs text-muted-foreground">
                    {formatClock(evt.atMs)} · {evt.kind}
                  </TaskItem>
                ))}
              </TaskContent>
            </Task>
          );
        })}
      </div>
    </div>
  );
}
