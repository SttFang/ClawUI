import { ScrollArea, cn } from "@clawui/ui";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useSubagentsStore, selectSelectedNode, selectHistory } from "@/store/subagents";

export function SubagentDetail() {
  const { t } = useTranslation("common");
  const { node, messages } = useSubagentsStore(
    useShallow((state) => {
      const selectedNode = selectSelectedNode(state);
      return {
        node: selectedNode,
        messages: selectHistory(state, selectedNode?.runId ?? null),
      };
    }),
  );

  if (!node) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        {t("subagent.selectHint")}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="text-xs font-medium truncate">{node.task}</span>
        {node.model && (
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {node.model}
          </span>
        )}
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-3">
          {messages.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {node.status === "running" || node.status === "spawning"
                ? t("subagent.loading")
                : t("subagent.noOutput")}
            </p>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs leading-relaxed",
                  msg.role === "assistant"
                    ? "bg-muted/60"
                    : msg.role === "user"
                      ? "bg-primary/5"
                      : "bg-yellow-500/10",
                )}
              >
                <span className="mb-0.5 block text-[10px] font-medium uppercase text-muted-foreground">
                  {msg.role}
                </span>
                <span className="whitespace-pre-wrap break-words">{msg.content}</span>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
