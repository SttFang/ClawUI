import type { DynamicToolUIPart } from "ai";
import { Task, TaskContent, TaskItem, TaskItemFile, TaskTrigger } from "@clawui/ui";
import { FileText, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SiReact } from "react-icons/si";
import { getCommandFromInput, isExecToolName, isReadToolName, toRecord } from "@/lib/exec";
import { cn } from "@/lib/utils";
import { makeExecApprovalKey, useExecApprovalsStore } from "@/store/execApprovals";
import { EXEC_RUNNING_TTL_MS } from "@/store/execApprovals/helpers";

const RUNNING_TICK_MS = 1000;
const DEFAULT_READ_PREVIEW_CHARS = 600;

function formatJson(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
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

type ToolCardRenderMode = "generic" | "read_compact";

function useNowTick(enabled: boolean): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return undefined;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, RUNNING_TICK_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [enabled]);
  return nowMs;
}

export function ToolEventCard(props: {
  part: DynamicToolUIPart;
  sessionKey?: string;
  renderMode?: ToolCardRenderMode;
  maxPreviewChars?: number;
}) {
  const { t } = useTranslation("common");
  const {
    part,
    sessionKey,
    renderMode = "generic",
    maxPreviewChars = DEFAULT_READ_PREVIEW_CHARS,
  } = props;
  const [showFullOutput, setShowFullOutput] = useState(false);

  const title = part.title?.trim() ? part.title : part.toolName;
  const state = part.state;
  const query = extractSearchQuery(part.input);
  const readPath = isReadToolName(part.toolName) ? extractReadPath(part.input) : "";
  const inputText = useMemo(() => formatJson(part.input), [part.input]);
  const outputText = useMemo(() => formatJson(part.output), [part.output]);
  const isReadCompact = renderMode === "read_compact" && isReadToolName(part.toolName);
  const isOutputTruncated =
    isReadCompact && state === "output-available" && outputText.length > maxPreviewChars;
  const compactOutputText =
    isReadCompact && !showFullOutput && isOutputTruncated
      ? `${outputText.slice(0, maxPreviewChars).trimEnd()}...`
      : outputText;

  const isExec = isExecToolName(part.toolName);
  const execCommand = isExec ? getCommandFromInput(part.input) : "";
  const normalizedExecCommand = execCommand.trim();

  const approvalRequested = useExecApprovalsStore((s) => {
    if (!isExec || !sessionKey || !normalizedExecCommand) return false;
    return s.queue.some(
      (entry) =>
        entry.request.sessionKey === sessionKey && entry.request.command === normalizedExecCommand,
    );
  });

  const runningAtMs = useExecApprovalsStore((s) => {
    if (!isExec || !sessionKey || !normalizedExecCommand) return 0;
    const runningKey = makeExecApprovalKey(sessionKey, normalizedExecCommand);
    return s.runningByKey[runningKey] ?? 0;
  });
  const nowMs = useNowTick(Boolean(isExec && runningAtMs));
  const isRunning = Boolean(runningAtMs && nowMs - runningAtMs < EXEC_RUNNING_TTL_MS);

  const stateLabel =
    state === "input-available" && approvalRequested
      ? t("a2ui.toolState.waitingApproval")
      : state === "input-available" && isRunning
        ? t("a2ui.toolState.running")
        : state;

  useEffect(() => {
    setShowFullOutput(false);
  }, [part.toolCallId]);

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
              <div className="inline-flex items-center gap-1">
                {t("a2ui.tool.readingFile")} <FileBadge path={readPath} />
              </div>
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
            <>
              <pre className="max-h-64 overflow-auto rounded-lg bg-muted px-3 py-2 text-xs break-words">
                {compactOutputText}
              </pre>
              {isOutputTruncated ? (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  onClick={() => setShowFullOutput((prev) => !prev)}
                >
                  {showFullOutput
                    ? t("a2ui.execAction.hideFullOutput")
                    : t("a2ui.execAction.viewFullOutput")}
                </button>
              ) : null}
            </>
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
