import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@clawui/ui";
import { ChevronDown, Download, MoreHorizontal, Plus } from "lucide-react";
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
      {/* Agent dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1.5 text-sm font-medium hover:text-foreground transition-colors">
            <span>{selectedAgentId ?? "main"}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {agents.map((agent) => (
            <DropdownMenuItem
              key={agent.id}
              onClick={() => selectAgent(agent.id)}
              className={cn(selectedAgentId === agent.id && "bg-accent")}
            >
              <span className="mr-1.5">{selectedAgentId === agent.id ? "\u25CF" : "\u25CB"}</span>
              {agent.id}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Plus className="mr-2 size-3.5" />
            {t("agents.agentDesktop.switcher.create")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
