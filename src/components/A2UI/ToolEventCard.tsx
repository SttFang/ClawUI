import type { DynamicToolUIPart } from "ai";
import { Card, CardContent } from "@clawui/ui";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { makeExecApprovalKey, useExecApprovalsStore } from "@/store/execApprovals";

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function StatePill(props: { state: string; preliminary?: boolean }) {
  const { t } = useTranslation("common");
  const { state, preliminary } = props;
  return (
    <div
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[11px]",
        "bg-muted text-muted-foreground",
        preliminary && "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
      )}
    >
      {preliminary ? t("a2ui.statePreliminary", { state }) : state}
    </div>
  );
}

function getExecCommand(input: unknown): string {
  if (typeof input !== "object" || input === null) return "";
  const cmd = (input as Record<string, unknown>)["command"];
  return typeof cmd === "string" ? cmd.trim() : "";
}

export function ToolEventCard(props: { part: DynamicToolUIPart; sessionKey?: string }) {
  const { t } = useTranslation("common");
  const { part, sessionKey } = props;

  const title = part.title?.trim() ? part.title : part.toolName;
  const state = part.state;

  const approvalQueue = useExecApprovalsStore((s) => s.queue);
  const runningByKey = useExecApprovalsStore((s) => s.runningByKey);

  const isExec = part.toolName === "exec";
  const execCommand = isExec ? getExecCommand(part.input) : "";
  const approvalRequested =
    isExec && execCommand
      ? approvalQueue.some(
          (e) => e.request.sessionKey === sessionKey && e.request.command === execCommand,
        )
      : false;
  const runningKey = isExec && execCommand ? makeExecApprovalKey(sessionKey, execCommand) : "";
  const runningAtMs = runningKey ? runningByKey[runningKey] : 0;
  const isRunning = Boolean(runningAtMs && Date.now() - runningAtMs < 2 * 60 * 1000);

  const stateLabel =
    state === "input-available" && approvalRequested
      ? t("a2ui.toolState.waitingApproval")
      : state === "input-available" && isRunning
        ? t("a2ui.toolState.running")
        : state;

  return (
    <Card className="rounded-xl">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{title}</div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {part.toolName} · {part.toolCallId}
            </div>
          </div>
          <StatePill
            state={stateLabel}
            preliminary={
              state === "output-available"
                ? (part as unknown as { preliminary?: boolean }).preliminary
                : false
            }
          />
        </div>

        {state === "input-available" && isRunning ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>{t("a2ui.toolState.runningHint")}</span>
          </div>
        ) : null}

        {state === "input-available" || state === "input-streaming" ? (
          <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-muted px-3 py-2 text-xs">
            {formatJson(part.input)}
          </pre>
        ) : null}

        {state === "output-available" ? (
          <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-muted px-3 py-2 text-xs">
            {formatJson(part.output)}
          </pre>
        ) : null}

        {state === "output-error" ? (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {part.errorText}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
