import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@clawui/ui";
import { Download, MoreHorizontal, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useAgentsStore, agentsSelectors } from "@/store/agents";

interface AgentSwitcherProps {
  onExport: () => void;
}

export function AgentSwitcher({ onExport }: AgentSwitcherProps) {
  const { t } = useTranslation("common");
  const agents = useAgentsStore(agentsSelectors.selectAgents);
  const selectedAgentId = useAgentsStore(agentsSelectors.selectSelectedAgentId);
  const selectAgent = useAgentsStore((s) => s.selectAgent);

  return (
    <div className="flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-1">
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => selectAgent(agent.id)}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              selectedAgentId === agent.id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {agent.emoji ? `${agent.emoji} ` : ""}
            {agent.name ?? agent.id}
          </button>
        ))}
        <button className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors">
          <Plus className="size-3.5" />
        </button>
      </div>

      {/* More actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onExport}>
            <Download className="mr-2 size-3.5" />
            {t("agents.actions.exportJson")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
