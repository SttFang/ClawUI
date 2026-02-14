import type { DynamicToolUIPart } from "ai";
import { Task, TaskContent, TaskItem, TaskItemFile, TaskTrigger } from "@clawui/ui";
import { FileText, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SiReact } from "react-icons/si";
import type { ExecApprovalsStore } from "@/store/execApprovals";
import { cn } from "@/lib/utils";
import { makeExecApprovalKey, useExecApprovalsStore } from "@/store/execApprovals";
import { EXEC_RUNNING_TTL_MS } from "@/store/execApprovals/helpers";

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function extractSearchQuery(input: unknown): string {
  const record = toRecord(input);
  if (!record) return "";
  const candidates = [record.query, record.q, record.search, record.text];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "";
}

function extractReadPath(input: unknown): string {
  const record = toRecord(input);
  if (!record) return "";
  const candidates = [record.path, record.filePath, record.filename, record.file];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "";
}

function fileNameFromPath(path: string): string {
  if (!path) return "";
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || path;
}

function FileBadge(props: { path: string }) {
  const fileName = fileNameFromPath(props.path);
  const isTsx = /\.tsx?$/i.test(fileName);
  return (
    <TaskItemFile>
      {isTsx ? <SiReact className="size-4" color="#149ECA" /> : <FileText className="size-4" />}
      <span>{fileName}</span>
    </TaskItemFile>
  );
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

function selectExecCardFlags(
  state: Pick<ExecApprovalsStore, "queue" | "runningByKey">,
  sessionKey: string | undefined,
  command: string,
): { approvalRequested: boolean; isRunning: boolean } {
  if (!sessionKey || !command) return { approvalRequested: false, isRunning: false };
  const normalizedCommand = command.trim();
  if (!normalizedCommand) return { approvalRequested: false, isRunning: false };
  const approvalRequested = state.queue.some(
    (entry) =>
      entry.request.sessionKey === sessionKey && entry.request.command === normalizedCommand,
  );
  const runningKey = makeExecApprovalKey(sessionKey, normalizedCommand);
  const runningAtMs = state.runningByKey[runningKey] ?? 0;
  const isRunning = Boolean(runningAtMs && Date.now() - runningAtMs < EXEC_RUNNING_TTL_MS);
  return { approvalRequested, isRunning };
}

export function ToolEventCard(props: { part: DynamicToolUIPart; sessionKey?: string }) {
  const { t } = useTranslation("common");
  const { part, sessionKey } = props;

  const title = part.title?.trim() ? part.title : part.toolName;
  const state = part.state;
  const query = extractSearchQuery(part.input);
  const readPath = part.toolName === "read" ? extractReadPath(part.input) : "";
  const inputText = useMemo(() => formatJson(part.input), [part.input]);
  const outputText = useMemo(() => formatJson(part.output), [part.output]);

  const isExec = part.toolName === "exec";
  const execCommand = isExec ? getExecCommand(part.input) : "";
  const execFlags = useExecApprovalsStore((s) => selectExecCardFlags(s, sessionKey, execCommand));
  const approvalRequested = isExec ? execFlags.approvalRequested : false;
  const isRunning = isExec ? execFlags.isRunning : false;

  const stateLabel =
    state === "input-available" && approvalRequested
      ? t("a2ui.toolState.waitingApproval")
      : state === "input-available" && isRunning
        ? t("a2ui.toolState.running")
        : state;

  return (
    <Task defaultOpen={state !== "output-error"}>
      <TaskTrigger title={title} />
      <TaskContent className="space-y-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <TaskItem className="truncate">
              <span className="text-xs">{part.toolName}</span>
              <span className="text-xs text-muted-foreground">{`· ${part.toolCallId}`}</span>
            </TaskItem>
            <StatePill
              state={stateLabel}
              preliminary={
                state === "output-available"
                  ? (part as unknown as { preliminary?: boolean }).preliminary
                  : false
              }
            />
          </div>

          {query ? <TaskItem>{t("a2ui.tool.searchingWithQuery", { query })}</TaskItem> : null}

          {readPath ? (
            <TaskItem>
              <span className="inline-flex items-center gap-1">
                {t("a2ui.tool.readingFile")} <FileBadge path={readPath} />
              </span>
            </TaskItem>
          ) : null}

          {state === "input-available" && isRunning ? (
            <TaskItem className="inline-flex items-center gap-2 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>{t("a2ui.toolState.runningHint")}</span>
            </TaskItem>
          ) : null}

          {state === "input-available" || state === "input-streaming" ? (
            <pre className="max-h-64 overflow-auto rounded-lg bg-muted px-3 py-2 text-xs break-words">
              {inputText}
            </pre>
          ) : null}

          {state === "output-available" ? (
            <pre className="max-h-64 overflow-auto rounded-lg bg-muted px-3 py-2 text-xs break-words">
              {outputText}
            </pre>
          ) : null}

          {state === "output-error" ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {part.errorText}
            </div>
          ) : null}
        </div>
      </TaskContent>
    </Task>
  );
}
