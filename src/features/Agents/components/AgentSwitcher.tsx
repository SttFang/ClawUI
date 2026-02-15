import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useAgentsStore, agentsSelectors } from "@/store/agents";

export function AgentSwitcher() {
  const { t } = useTranslation("common");
  const agents = useAgentsStore(agentsSelectors.selectAgents);
  const selectedAgentId = useAgentsStore(agentsSelectors.selectSelectedAgentId);
  const selectAgent = useAgentsStore((s) => s.selectAgent);

  return (
    <div className="flex items-center gap-1 border-b px-2 py-1.5">
      {agents.map((agent) => {
        const isSelected = selectedAgentId === agent.id;
        return (
          <button
            key={agent.id}
            onClick={() => selectAgent(agent.id)}
            className={cn(
              "relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isSelected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="mr-1.5">{isSelected ? "\u25CF" : "\u25CB"}</span>
            {agent.id}
            {isSelected && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary" />
            )}
          </button>
        );
      })}
      <button
        className="ml-1 rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors"
        title={t("agents.agentDesktop.switcher.create")}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
