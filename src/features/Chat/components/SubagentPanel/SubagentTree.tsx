import { ScrollArea } from "@clawui/ui";
import { useTranslation } from "react-i18next";
import { useSubagentsStore, selectNodeList, selectSelectedRunId } from "@/store/subagents";
import { SubagentNodeItem } from "./SubagentNodeItem";

export function SubagentTree() {
  const { t } = useTranslation("common");
  const nodes = useSubagentsStore(selectNodeList);
  const selectedRunId = useSubagentsStore(selectSelectedRunId);
  const select = useSubagentsStore((s) => s.select);

  if (nodes.length === 0) {
    return <div className="px-3 py-4 text-xs text-muted-foreground">{t("subagent.empty")}</div>;
  }

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-0.5 p-1">
        {nodes.map((node) => (
          <SubagentNodeItem
            key={node.runId}
            node={node}
            selected={node.runId === selectedRunId}
            onSelect={select}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
