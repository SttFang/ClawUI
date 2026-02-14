import type { DynamicToolUIPart } from "ai";
import { Task, TaskContent, TaskTrigger } from "@clawui/ui";
import { useTranslation } from "react-i18next";
import { ToolItem } from "./ToolItem";

type ToolGroupProps = {
  parts: DynamicToolUIPart[];
};

export function ToolGroup({ parts }: ToolGroupProps) {
  const { t } = useTranslation("common");

  const allDone = parts.every((p) => p.state === "output-available" || p.state === "output-error");
  const doneCount = parts.filter(
    (p) => p.state === "output-available" || p.state === "output-error",
  ).length;

  const title = allDone
    ? `${t("a2ui.explored")} (${parts.length})`
    : `${t("a2ui.exploring")} (${doneCount}/${parts.length})`;

  return (
    <Task defaultOpen={!allDone}>
      <TaskTrigger title={title} />
      <TaskContent className="space-y-0">
        {parts.map((part) => (
          <ToolItem key={part.toolCallId} part={part} />
        ))}
      </TaskContent>
    </Task>
  );
}
