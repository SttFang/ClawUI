import type { DynamicToolUIPart } from "ai";
import {
  ChainOfAction,
  ChainOfActionContent,
  ChainOfActionShimmer,
  ChainOfActionTrigger,
} from "@clawui/ui";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { makeExecApprovalKey, useExecApprovalsStore } from "@/store/execApprovals";
import { upsertExecTrace } from "./execTrace";

function getCommand(input: unknown): string {
  if (typeof input !== "object" || input === null) return "";
  const cmd = (input as Record<string, unknown>).command;
  return typeof cmd === "string" ? cmd.trim() : "";
}

export function ExecActionItem(props: { part: DynamicToolUIPart; sessionKey?: string }) {
  const { t } = useTranslation("common");
  const { part, sessionKey } = props;

  const [expanded, setExpanded] = useState(false);
  const trace = upsertExecTrace(part, sessionKey);
  const command = getCommand(part.input) || trace.command;

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
  const isRunning =
    part.state === "input-available" || part.state === "input-streaming" || Boolean(runningAtMs);

  const subtitle = approvalRequested
    ? t("a2ui.toolState.waitingApproval")
    : isRunning
      ? t("a2ui.toolState.running")
      : part.state;

  return (
    <ChainOfAction className="overflow-hidden">
      <ChainOfActionTrigger
        title={command || "exec"}
        subtitle={subtitle}
        expanded={expanded}
        loading={isRunning}
        onToggle={() => setExpanded((v) => !v)}
      />
      {isRunning ? (
        <div className="px-3 pb-2">
          <ChainOfActionShimmer label={t("a2ui.execAction.thinking")} />
        </div>
      ) : null}
      <ChainOfActionContent open={expanded}>
        <pre className="max-h-64 overflow-auto rounded-md bg-muted px-3 py-2 text-xs">
          {JSON.stringify(part.input ?? {}, null, 2)}
        </pre>
      </ChainOfActionContent>
    </ChainOfAction>
  );
}
