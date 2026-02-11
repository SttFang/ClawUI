import type { DynamicToolUIPart } from "ai";
import {
  ChainOfAction,
  ChainOfActionContent,
  ChainOfActionShimmer,
  ChainOfActionTrigger,
} from "@clawui/ui";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { makeExecApprovalKey, useExecApprovalsStore } from "@/store/execApprovals";
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

  const queue = useExecApprovalsStore((s) => s.queue);
  const runningByKey = useExecApprovalsStore((s) => s.runningByKey);

  const approvalRequested = useMemo(
    () =>
      Boolean(
        command &&
        queue.some(
          (e) => e.request.sessionKey === (sessionKey ?? "") && e.request.command === command,
        ),
      ),
    [command, queue, sessionKey],
  );

  const runningKey = command ? makeExecApprovalKey(sessionKey, command) : "";
  const runningAtMs = runningKey ? runningByKey[runningKey] : 0;
  const visualState = deriveExecActionState({
    partState:
      part.state === "input-streaming" || part.state === "output-available"
        ? part.state
        : "input-available",
    preliminary: part.state === "output-available" ? isExecPreliminary(part) : false,
    approvalRequested,
    runningMarked: Boolean(runningAtMs),
  });

  useEffect(() => {
    if (approvalRequested || visualState.running) {
      setExpanded(true);
    }
  }, [approvalRequested, visualState.running]);

  const statusLabel =
    visualState.statusKey === "waitingApproval"
      ? t("a2ui.toolState.waitingApproval")
      : visualState.statusKey === "running"
        ? t("a2ui.toolState.running")
        : part.state;

  return (
    <ChainOfAction className="overflow-hidden">
      <ChainOfActionTrigger
        title={command || "exec"}
        status={visualState.status}
        statusLabel={statusLabel}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
      />
      {visualState.running ? (
        <div className="px-3 pb-2">
          <ChainOfActionShimmer label={t("a2ui.execAction.thinking")} />
        </div>
      ) : null}
      <ChainOfActionContent open={expanded}>
        <div className="space-y-2 text-xs">
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
      </ChainOfActionContent>
    </ChainOfAction>
  );
}
