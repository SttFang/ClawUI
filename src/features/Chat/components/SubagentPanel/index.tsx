import { Button, cn } from "@clawui/ui";
import { X, StopCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ipc } from "@/lib/ipc";
import { chatLog } from "@/lib/logger";
import { useSubagentsStore, selectActiveCount, selectSelectedNode } from "@/store/subagents";
import { SubagentDetail } from "./SubagentDetail";
import { SubagentTree } from "./SubagentTree";
import { useSubagentPolling } from "./useSubagentPolling";

export function SubagentPanel({ className }: { className?: string }) {
  const { t } = useTranslation("common");
  const activeCount = useSubagentsStore(selectActiveCount);
  const selectedNode = useSubagentsStore(selectSelectedNode);
  const togglePanel = useSubagentsStore((s) => s.togglePanel);

  useSubagentPolling();

  const handleKill = async () => {
    if (!selectedNode || selectedNode.status !== "running") return;
    try {
      await ipc.chat.request("sessions.kill", {
        sessionKey: selectedNode.sessionKey,
      });
      useSubagentsStore.getState().updateStatus(selectedNode.runId, "error", "killed");
    } catch (err) {
      chatLog.warn("[subagent.kill.failed]", String(err));
    }
  };

  return (
    <div className={cn("flex flex-col overflow-hidden border-l bg-background", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("subagent.title")}</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-500">
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {selectedNode?.status === "running" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleKill}
              title={t("subagent.kill")}
            >
              <StopCircle className="h-3.5 w-3.5 text-red-500" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => togglePanel(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Tree (top half) */}
      <div className="flex max-h-[40%] flex-col border-b">
        <SubagentTree />
      </div>

      {/* Detail (bottom half) */}
      <SubagentDetail />
    </div>
  );
}
