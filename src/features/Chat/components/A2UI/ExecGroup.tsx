import type { DynamicToolUIPart } from "ai";
import { Task, TaskContent, TaskTrigger } from "@clawui/ui";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExecTool } from "./ExecTool";
import { isExecPreliminary, isOutputStillRunning } from "./execTrace/types";

type ExecGroupProps = {
  parts: DynamicToolUIPart[];
  sessionKey: string;
};

function isExecPartDone(p: DynamicToolUIPart): boolean {
  if (p.state === "output-error") return true;
  if (p.state !== "output-available") return false;
  return !isExecPreliminary(p) && !isOutputStillRunning(p);
}

export function ExecGroup({ parts, sessionKey }: ExecGroupProps) {
  const { t } = useTranslation("common");

  const allDone = parts.every(isExecPartDone);
  const doneCount = parts.filter(isExecPartDone).length;

  const [open, setOpen] = useState(!allDone);
  const prevDone = useRef(allDone);
  useEffect(() => {
    if (allDone !== prevDone.current) {
      setOpen(!allDone);
      prevDone.current = allDone;
    }
  }, [allDone]);

  const title = allDone
    ? `${t("a2ui.exec.completed")} (${parts.length})`
    : `${t("a2ui.exec.inProgress")} (${doneCount}/${parts.length})`;

  return (
    <Task open={open} onOpenChange={setOpen}>
      <TaskTrigger title={title} />
      <TaskContent className="space-y-0">
        {parts.map((part) => (
          <ExecTool key={part.toolCallId} part={part} sessionKey={sessionKey} />
        ))}
      </TaskContent>
    </Task>
  );
}
