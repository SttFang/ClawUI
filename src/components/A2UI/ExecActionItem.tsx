import { Task, TaskContent, TaskItem, TaskTrigger } from "@clawui/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ExecLifecycleRecord } from "@/store/exec";
import { extractPrimaryExecCommand, titleizeCommandName } from "./execDisplay";

export function ExecActionItem(props: { record: ExecLifecycleRecord }) {
  const { t } = useTranslation("common");
  const { record } = props;

  const [expanded, setExpanded] = useState(false);
  const command = record.command;
  const primaryCommand = extractPrimaryExecCommand(command);
  const commandDisplay = primaryCommand || t("a2ui.execAction.noCommand");
  const triggerTitle = primaryCommand
    ? t("a2ui.execAction.ranCommand", { command: titleizeCommandName(primaryCommand) })
    : t("a2ui.execAction.noCommand");

  useEffect(() => {
    if (record.status === "pending_approval" || record.status === "running") {
      setExpanded(true);
    }
  }, [record.status]);

  let statusLabel = t("a2ui.toolState.pending");
  if (record.status === "pending_approval") {
    statusLabel = t("a2ui.toolState.waitingApproval");
  } else if (record.status === "running") {
    statusLabel = t("a2ui.toolState.running");
  } else if (record.status === "completed") {
    statusLabel = t("a2ui.execAction.statusDone");
  } else if (record.status === "denied") {
    statusLabel = t("a2ui.execAction.statusDenied");
  } else if (record.status === "timeout") {
    statusLabel = t("a2ui.execAction.statusTimeout");
  } else if (record.status === "error") {
    statusLabel = t("a2ui.execAction.statusError");
  }

  const approvalShortId = record.approvalId ? record.approvalId.slice(-8) : "";

  return (
    <Task open={expanded} onOpenChange={setExpanded}>
      <TaskTrigger title={triggerTitle} />
      <TaskContent className="space-y-2">
        <div className="space-y-2">
          <TaskItem className="inline-flex items-center gap-2 text-xs">
            <span>{statusLabel}</span>
            {approvalShortId ? (
              <span className="text-muted-foreground">{`#${approvalShortId}`}</span>
            ) : null}
          </TaskItem>

          {record.status === "running" ? (
            <TaskItem className="text-xs text-muted-foreground">
              {t("a2ui.execAction.thinking")}
            </TaskItem>
          ) : null}

          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">{t("a2ui.execAction.command")}</div>
            <pre className="max-h-44 overflow-auto rounded-md bg-muted px-2 py-1.5 text-xs break-words">
              {commandDisplay}
            </pre>
          </div>
          {record.cwd ? (
            <div className="flex items-center gap-2">
              <div className="shrink-0 text-[11px] text-muted-foreground">
                {t("a2ui.execAction.cwd")}
              </div>
              <code className="min-w-0 truncate rounded bg-muted px-1.5 py-0.5">{record.cwd}</code>
            </div>
          ) : null}
          {typeof record.yieldMs === "number" ? (
            <div className="flex items-center gap-2">
              <div className="shrink-0 text-[11px] text-muted-foreground">
                {t("a2ui.execAction.yieldMs")}
              </div>
              <code className="rounded bg-muted px-1.5 py-0.5">{record.yieldMs}</code>
            </div>
          ) : null}
        </div>
      </TaskContent>
    </Task>
  );
}
