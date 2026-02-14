import type { DynamicToolUIPart } from "ai";
import { Task, TaskContent, TaskItem, TaskTrigger } from "@clawui/ui";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useA2UIExecTraceStore } from "@/store/a2uiExecTrace/store";
import { makeExecApprovalKey, useExecApprovalsStore } from "@/store/execApprovals";
import { deriveExecActionState } from "./execActionState";
import {
  buildExecTraceKey,
  commitExecTraceUpdate,
  deriveNextExecTrace,
  isExecPreliminary,
  selectTerminalByCommandKey,
  selectTraceByKey,
} from "./execTrace";

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
  const parsed = useMemo(() => parseExecInput(part.input), [part.input]);
  const normalizedSessionKey = sessionKey ?? "";
  const traceKey = buildExecTraceKey(normalizedSessionKey, part.toolCallId);

  const storedTrace = useA2UIExecTraceStore((s) => selectTraceByKey(s, traceKey));
  const fallbackTrace = useMemo(
    () =>
      deriveNextExecTrace({
        part,
        sessionKey: normalizedSessionKey,
      }).nextTrace,
    [normalizedSessionKey, part],
  );
  const trace = storedTrace ?? fallbackTrace;

  const command = parsed.command || trace.command;
  const isInputPhase = part.state === "input-available" || part.state === "input-streaming";
  const currentApprovalId = useExecApprovalsStore((s) => {
    if (!isInputPhase) return null;
    if (!command) return null;
    const matched = s.queue.find(
      (entry) =>
        entry.request.sessionKey === normalizedSessionKey && entry.request.command === command,
    );
    return matched?.id ?? null;
  });
  const approvalRequested = Boolean(currentApprovalId);

  const runningKey = command ? makeExecApprovalKey(normalizedSessionKey, command) : "";
  const runningAtMs = useExecApprovalsStore((s) =>
    runningKey ? (s.runningByKey[runningKey] ?? 0) : 0,
  );
  const commandTerminal = useA2UIExecTraceStore((s) =>
    runningKey ? selectTerminalByCommandKey(s, runningKey) : null,
  );

  const coveredByCommandTerminal = useMemo(() => {
    if (!commandTerminal) return false;
    if (commandTerminal.traceKey === trace.traceKey) return false;
    if (trace.status === "completed" || trace.status === "error") return false;
    if (trace.startedAtMs > commandTerminal.endedAtMs) return false;
    if (
      trace.toolOrder !== null &&
      commandTerminal.toolOrder !== null &&
      trace.toolOrder > commandTerminal.toolOrder
    ) {
      return false;
    }
    return true;
  }, [commandTerminal, trace]);

  const visualState = deriveExecActionState({
    partState:
      part.state === "input-streaming" ||
      part.state === "output-available" ||
      part.state === "output-error"
        ? part.state
        : "input-available",
    preliminary: part.state === "output-available" ? isExecPreliminary(part) : false,
    approvalRequested,
    runningMarked:
      !coveredByCommandTerminal &&
      Boolean(runningAtMs) &&
      trace.status !== "completed" &&
      trace.status !== "error",
    traceRunning: !coveredByCommandTerminal && trace.status === "running",
    hasFinalOutput:
      (part.state === "output-available" && !isExecPreliminary(part)) ||
      trace.status === "completed",
    coveredByCommandTerminal,
    hasError: part.state === "output-error" || trace.status === "error",
  });

  useEffect(() => {
    if (!normalizedSessionKey) return;
    commitExecTraceUpdate({ part, sessionKey: normalizedSessionKey });
  }, [normalizedSessionKey, part.toolCallId, part.state, part.input, part.output, part.errorText]);

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

  const approvalShortId = currentApprovalId ? currentApprovalId.slice(-8) : "";

  return (
    <Task open={expanded} onOpenChange={setExpanded}>
      <TaskTrigger title={command || "exec"} />
      <TaskContent className="space-y-2">
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
            <pre className="max-h-44 overflow-auto rounded-md bg-muted px-2 py-1.5 text-xs break-words">
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
