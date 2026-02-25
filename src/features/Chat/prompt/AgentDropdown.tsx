import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@clawui/ui";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useAgentsStore, agentsSelectors } from "@/store/agents";

const triggerCn = cn(
  "inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-xs",
  "text-muted-foreground hover:bg-accent hover:text-foreground",
  "disabled:pointer-events-none disabled:opacity-50",
  "h-7 cursor-default outline-none",
);

export function AgentDropdown(props: { disabled?: boolean }) {
  const { t } = useTranslation("chat");
  const agents = useAgentsStore(agentsSelectors.selectAgents);
  const selectedId = useAgentsStore(agentsSelectors.selectSelectedAgentId);
  const selectAgent = useAgentsStore((s) => s.selectAgent);

  if (agents.length <= 1) return null;

  const current = agents.find((a) => a.id === selectedId) ?? agents[0];
  const label = current ? `${current.emoji ?? ""} ${current.name ?? current.id}`.trim() : "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={props.disabled}>
        <button className={triggerCn}>
          <span className="max-w-[120px] truncate">{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{t("agentDropdown.label")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={selectedId ?? ""} onValueChange={selectAgent}>
          {agents.map((a) => (
            <DropdownMenuRadioItem key={a.id} value={a.id}>
              {a.emoji ? `${a.emoji} ` : ""}
              {a.name ?? a.id}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
