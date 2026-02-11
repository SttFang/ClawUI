import { Task, TaskContent, TaskItem, TaskItemFile, TaskTrigger } from "@clawui/ui";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRunMapStore } from "@/store/runMap";

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

export function RunTimelinePanel(props: { sessionKey: string }) {
  const { sessionKey } = props;
  const { t } = useTranslation("common");
  const session = useRunMapStore((state) => state.sessions[sessionKey]);

  const runs = useMemo(() => {
    if (!session) return [];
    return Object.values(session.runsById).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }, [session]);

  if (!session || runs.length === 0) return null;

  return (
    <div className="mx-auto mb-3 w-full max-w-3xl rounded-xl border border-border/70 bg-card/60 p-3">
      <div className="mb-2 text-xs text-muted-foreground">RunIdMap</div>
      <div className="space-y-3">
        {runs.map((run) => {
          const approvalIds = session.indexes.approvalIdsByRunId[run.runId] ?? [];
          const toolCallIds = session.indexes.toolCallIdsByRunId[run.runId] ?? [];
          const timeline = session.timeline
            .filter(
              (evt) =>
                evt.runId === run.runId ||
                (evt.approvalId ? approvalIds.includes(evt.approvalId) : false) ||
                (evt.toolCallId ? toolCallIds.includes(evt.toolCallId) : false),
            )
            .slice(-8);

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
                {approvalIds.map((approvalId) => {
                  const approval = session.approvalsById[approvalId];
                  if (!approval) return null;
                  return (
                    <TaskItem
                      key={`approval:${approvalId}`}
                      className="inline-flex items-center gap-2 text-xs"
                    >
                      <TaskItemFile>{`approval:${approvalId}`}</TaskItemFile>
                      <span>{approval.status}</span>
                      {approval.decision ? <span>({approval.decision})</span> : null}
                    </TaskItem>
                  );
                })}
                {toolCallIds.map((toolCallId) => {
                  const tool = session.toolCallsById[toolCallId];
                  if (!tool) return null;
                  return (
                    <TaskItem
                      key={`tool:${toolCallId}`}
                      className="inline-flex items-center gap-2 text-xs"
                    >
                      <TaskItemFile>{tool.toolName}</TaskItemFile>
                      <span>{toolCallId}</span>
                      <span>{tool.phase}</span>
                    </TaskItem>
                  );
                })}
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
