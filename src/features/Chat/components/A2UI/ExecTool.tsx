import type { DynamicToolUIPart } from "ai";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@clawui/ui";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getCommandFromInput } from "@/lib/exec";
import { cn } from "@/lib/utils";
import type { ExecApprovalAugmentation } from "../hooks/useExecApprovalStatus";
import { useExecApprovalStatus } from "../hooks/useExecApprovalStatus";
import { extractPrimaryExecCommand, titleizeCommandName } from "./execDisplay";
import { formatJson, getCwdFromInput } from "./toolHelpers";

type ExecDisplayStatus = "pending" | "pending_approval" | "running" | "completed" | "error";

function isExecPreliminary(part: DynamicToolUIPart): boolean {
  return (part as unknown as { preliminary?: unknown }).preliminary === true;
}

function deriveDisplayStatus(
  part: DynamicToolUIPart,
  approval: ExecApprovalAugmentation,
): ExecDisplayStatus {
  if (part.state === "output-error") return "error";
  if (part.state === "output-available" && !isExecPreliminary(part)) return "completed";
  if (part.state === "output-available" && isExecPreliminary(part)) return "running";
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
  const title = titleizeCommandName(primaryCmd);

  let label: string;
  if (status === "running") {
    label = t("a2ui.exec.running", { command: title });
  } else if (status === "completed") {
    label = t("a2ui.exec.ran", { command: title });
  } else if (status === "error") {
    label = t("a2ui.exec.failed", { command: title });
  } else if (status === "pending_approval") {
    label = t("a2ui.exec.awaitingApproval", { command: title });
  } else {
    label = t("a2ui.exec.pending", { command: title });
  }

  const autoOpen = status === "running" || status === "pending_approval";
  const cwd = getCwdFromInput(part.input);

  return (
    <Collapsible defaultOpen={autoOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <StatusDot status={status} />
        <span>{label}</span>
        <ChevronDown className="size-4 shrink-0 transition-transform [[data-state=closed]>&]:rotate-[-90deg]" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-2 border-l-2 border-muted pl-4">
          <pre className="max-h-44 overflow-auto rounded-md bg-muted px-2 py-1.5 text-xs break-words whitespace-pre-wrap">
            {command}
          </pre>
          {cwd && <div className="text-xs text-muted-foreground">in {cwd}</div>}
          {status === "completed" && part.output != null && (
            <pre className="max-h-64 overflow-auto rounded-md bg-muted px-2 py-1.5 text-xs break-words whitespace-pre-wrap">
              {formatJson(part.output)}
            </pre>
          )}
          {status === "error" && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
              {part.errorText}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
