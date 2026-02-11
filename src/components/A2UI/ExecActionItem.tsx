import type { DynamicToolUIPart } from "ai";
import { Task, TaskContent, TaskItem, TaskTrigger } from "@clawui/ui";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getPendingApprovalsForSession,
  makeExecApprovalKey,
  useExecApprovalsStore,
} from "@/store/execApprovals";
import { deriveExecActionState } from "./execActionState";
import { isExecPreliminary, upsertExecTrace } from "./execTrace";

function parseExecInput(input: unknown): { command: string; cwd?: string; yieldMs?: number } {
  if (typeof input !== "object" || input === null) return { command: "" };
  const record = input as Record<string, unknown>;
  const command = typeof record.command === "string" ? record.command.trim() : "";
  const cwd = typeof record.cwd === "string" ? record.cwd : undefined;
  const yieldMs = typeof record.yieldMs === "number" ? record.yieldMs : undefined;
  return { command, cwd, yieldMs };
}

export function ExecActionItem(props: { part: DynamicToolUIPart; sessionKey?: string }) {
  const { t } = useTranslation("common");
  const { part, sessionKey } = props;

  const [expanded, setExpanded] = useState(false);
  const trace = upsertExecTrace(part, sessionKey);
  const parsed = parseExecInput(part.input);
  const command = parsed.command || trace.command;
  const normalizedSessionKey = sessionKey ?? "";

  const queue = useExecApprovalsStore((s) => s.queue);
  const pendingApprovals = useMemo(
    () => getPendingApprovalsForSession(queue, normalizedSessionKey),
    [queue, normalizedSessionKey],
  );
  const runningByKey = useExecApprovalsStore((s) => s.runningByKey);

  const currentApproval = useMemo(() => {
    if (!command) return null;
    return pendingApprovals.find((entry) => entry.request.command === command) ?? null;
  }, [command, pendingApprovals]);

  const approvalRequested = Boolean(currentApproval);

  const runningKey = command ? makeExecApprovalKey(normalizedSessionKey, command) : "";
  const runningAtMs = runningKey ? runningByKey[runningKey] : 0;
  const visualState = deriveExecActionState({
    partState:
      part.state === "input-streaming" ||
      part.state === "output-available" ||
      part.state === "output-error"
        ? part.state
        : "input-available",
    preliminary: part.state === "output-available" ? isExecPreliminary(part) : false,
    approvalRequested,
    runningMarked: Boolean(runningAtMs) && trace.status !== "completed" && trace.status !== "error",
    hasFinalOutput:
      (part.state === "output-available" && !isExecPreliminary(part)) ||
      trace.status === "completed",
    hasError: part.state === "output-error" || trace.status === "error",
  });

  useEffect(() => {
    if (approvalRequested || visualState.running) {
      setExpanded(true);
    }
  }, [approvalRequested, visualState.running]);

  let statusLabel = t("a2ui.toolState.pending");
  if (visualState.statusKey === "waitingApproval") {
    statusLabel = t("a2ui.toolState.waitingApproval");
  } else if (visualState.statusKey === "running") {
    statusLabel = t("a2ui.toolState.running");
  } else if (visualState.statusKey === "completed") {
    statusLabel = t("a2ui.execAction.statusDone");
  } else if (visualState.statusKey === "error") {
    statusLabel = t("a2ui.execAction.statusError");
  }

  const approvalShortId = currentApproval ? currentApproval.id.slice(-8) : "";

  return (
    <Task open={expanded} onOpenChange={setExpanded}>
      <TaskTrigger title={command || "exec"} />
      <TaskContent>
        <div className="space-y-2">
          <TaskItem className="inline-flex items-center gap-2 text-xs">
            <span>{statusLabel}</span>
            {approvalShortId ? (
              <span className="text-muted-foreground">{`#${approvalShortId}`}</span>
            ) : null}
          </TaskItem>

          {visualState.running ? (
            <TaskItem className="text-xs text-muted-foreground">
              {t("a2ui.execAction.thinking")}
            </TaskItem>
          ) : null}

          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">{t("a2ui.execAction.command")}</div>
            <pre className="max-h-44 overflow-auto rounded-md bg-muted px-2 py-1.5 text-xs">
              {command || t("a2ui.execAction.noCommand")}
            </pre>
          </div>
          {parsed.cwd ? (
            <div className="flex items-center gap-2">
              <div className="shrink-0 text-[11px] text-muted-foreground">
                {t("a2ui.execAction.cwd")}
              </div>
              <code className="min-w-0 truncate rounded bg-muted px-1.5 py-0.5">{parsed.cwd}</code>
            </div>
          ) : null}
          {typeof parsed.yieldMs === "number" ? (
            <div className="flex items-center gap-2">
              <div className="shrink-0 text-[11px] text-muted-foreground">
                {t("a2ui.execAction.yieldMs")}
              </div>
              <code className="rounded bg-muted px-1.5 py-0.5">{parsed.yieldMs}</code>
            </div>
          ) : null}
        </div>
      </TaskContent>
    </Task>
  );
}
