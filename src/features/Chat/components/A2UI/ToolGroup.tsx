import type { DynamicToolUIPart } from "ai";
import { Task, TaskContent, TaskTrigger } from "@clawui/ui";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ToolItem } from "./ToolItem";

const SCROLL_THRESHOLD = 4;

type ToolGroupProps = {
  parts: DynamicToolUIPart[];
};

export function ToolGroup({ parts }: ToolGroupProps) {
  const { t } = useTranslation("common");
  const scrollRef = useRef<HTMLDivElement>(null);

  const allDone = parts.every((p) => p.state === "output-available" || p.state === "output-error");
  const doneCount = parts.filter(
    (p) => p.state === "output-available" || p.state === "output-error",
  ).length;

  const [open, setOpen] = useState(!allDone);
  const [userToggled, setUserToggled] = useState(false);
  const prevAllDoneRef = useRef(allDone);

  useEffect(() => {
    if (allDone === prevAllDoneRef.current) return;
    prevAllDoneRef.current = allDone;
    if (allDone && !userToggled) setOpen(false);
    if (!allDone) {
      setOpen(true);
      setUserToggled(false);
    }
  }, [allDone, userToggled]);

  useEffect(() => {
    if (!open || allDone || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [doneCount, parts.length, open, allDone]);

  const handleOpenChange = (next: boolean) => {
    setUserToggled(true);
    setOpen(next);
  };

  const title = allDone
    ? `${t("a2ui.explored")} (${parts.length})`
    : `${t("a2ui.exploring")} (${doneCount}/${parts.length})`;

  return (
    <Task open={open} onOpenChange={handleOpenChange}>
      <TaskTrigger title={title} />
      <TaskContent className="space-y-0">
        <div
          ref={scrollRef}
          className={cn(parts.length > SCROLL_THRESHOLD && "max-h-36 overflow-y-auto")}
        >
          {parts.map((part) => (
            <ToolItem key={part.toolCallId} part={part} />
          ))}
        </div>
      </TaskContent>
    </Task>
  );
}
