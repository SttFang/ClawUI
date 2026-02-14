import type { DynamicToolUIPart } from "ai";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@clawui/ui";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
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

  const title = allDone ? t("a2ui.explored") : t("a2ui.exploring");
  const count = allDone ? `(${parts.length})` : `(${doneCount}/${parts.length})`;

  return (
    <Collapsible defaultOpen={!allDone}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ChevronDown
          className={cn(
            "size-4 shrink-0 transition-transform",
            "[[data-state=closed]>&]:rotate-[-90deg]",
          )}
        />
        <span>{title}</span>
        <span className="text-xs text-muted-foreground">{count}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 space-y-0 border-l-2 border-muted pl-4">
          {parts.map((part) => (
            <ToolItem key={part.toolCallId} part={part} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
