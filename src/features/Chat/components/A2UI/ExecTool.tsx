import type { DynamicToolUIPart } from "ai";
import { Task, TaskContent, TaskItem, TaskTrigger } from "@clawui/ui";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCommandFromInput } from "@/lib/exec";
import { cn } from "@/lib/utils";
import type { ExecApprovalAugmentation } from "../hooks/useExecApprovalStatus";
import { useExecApprovalStatus } from "../hooks/useExecApprovalStatus";
import { extractPrimaryExecCommand } from "./execDisplay";
import { isExecPreliminary, isOutputStillRunning } from "./execTrace/types";
import { formatJson, getCwdFromInput } from "./toolHelpers";

type ExecDisplayStatus = "pending" | "pending_approval" | "running" | "completed" | "error";

function deriveDisplayStatus(
  part: DynamicToolUIPart,
  approval: ExecApprovalAugmentation,
): ExecDisplayStatus {
  if (part.state === "output-error") return "error";
  if (part.state === "output-available") {
    if (isExecPreliminary(part) || isOutputStillRunning(part)) return "running";
    return "completed";
  }
  if (part.state === "input-streaming") return "running";
  if (approval?.status === "running") return "running";
  if (approval?.status === "pending_approval") return "pending_approval";
  return "pending";
}

function StatusDot(props: { status: ExecDisplayStatus }) {
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        props.status === "completed" && "bg-emerald-500",
        props.status === "error" && "bg-destructive",
        (props.status === "running" || props.status === "pending") && "animate-pulse bg-blue-500",
        props.status === "pending_approval" && "animate-pulse bg-amber-500",
      )}
    />
  );
}

export function ExecTool(props: { part: DynamicToolUIPart; sessionKey: string }) {
  const { part, sessionKey } = props;
  const { t } = useTranslation("common");
  const approval = useExecApprovalStatus(part, sessionKey);
  const status = deriveDisplayStatus(part, approval);

  const command = getCommandFromInput(part.input);
  const primaryCmd = extractPrimaryExecCommand(command);

  let label: string;
  if (status === "running") {
    label = t("a2ui.exec.running", { command: primaryCmd });
  } else if (status === "completed") {
    label = t("a2ui.exec.ran", { command: primaryCmd });
  } else if (status === "error") {
    label = t("a2ui.exec.failed", { command: primaryCmd });
  } else if (status === "pending_approval") {
    label = t("a2ui.exec.awaitingApproval", { command: primaryCmd });
  } else {
    label = t("a2ui.exec.pending", { command: primaryCmd });
  }

  const isActive = status === "running" || status === "pending_approval";
  const [open, setOpen] = useState(isActive);
  const prevActive = useRef(isActive);
  useEffect(() => {
    if (isActive !== prevActive.current) {
      setOpen(isActive);
      prevActive.current = isActive;
    }
  }, [isActive]);

  const cwd = getCwdFromInput(part.input);

  return (
    <Task open={open} onOpenChange={setOpen}>
      <TaskTrigger title={label}>
        <div className="flex w-full cursor-pointer items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <StatusDot status={status} />
          <p className="text-sm">{label}</p>
        </div>
      </TaskTrigger>
      <TaskContent className="space-y-2">
        <pre className="max-h-44 overflow-auto rounded-md bg-muted px-2 py-1.5 text-xs break-words whitespace-pre-wrap">
          {command}
        </pre>
        {cwd && <TaskItem className="text-xs text-muted-foreground">in {cwd}</TaskItem>}
        {(status === "completed" || status === "running") && part.output != null && (
          <pre className="max-h-64 overflow-auto rounded-md bg-muted px-2 py-1.5 text-xs break-words whitespace-pre-wrap">
            {formatJson(part.output)}
          </pre>
        )}
        {status === "error" && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
            {part.errorText}
          </div>
        )}
      </TaskContent>
    </Task>
  );
}
