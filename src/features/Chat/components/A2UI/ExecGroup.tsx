import type { DynamicToolUIPart } from "ai";
import { Task, TaskContent, TaskTrigger } from "@clawui/ui";
import { useTranslation } from "react-i18next";
import { ExecTool } from "./ExecTool";

type ExecGroupProps = {
  parts: DynamicToolUIPart[];
  sessionKey: string;
};

export function ExecGroup({ parts, sessionKey }: ExecGroupProps) {
  const { t } = useTranslation("common");

  const allDone = parts.every((p) => p.state === "output-available" || p.state === "output-error");
  const doneCount = parts.filter(
    (p) => p.state === "output-available" || p.state === "output-error",
  ).length;

  const title = allDone
    ? `${t("a2ui.exec.completed")} (${parts.length})`
    : `${t("a2ui.exec.inProgress")} (${doneCount}/${parts.length})`;

  return (
    <Task defaultOpen={!allDone}>
      <TaskTrigger title={title} />
      <TaskContent className="space-y-0">
        {parts.map((part) => (
          <ExecTool key={part.toolCallId} part={part} sessionKey={sessionKey} />
        ))}
      </TaskContent>
    </Task>
  );
}
