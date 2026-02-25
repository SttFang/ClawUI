import { cn } from "@/lib/utils";
import { useAgentsStore, agentsSelectors } from "@/store/agents";

export function AgentTabs() {
  const agents = useAgentsStore(agentsSelectors.selectAgents);
  const selectedId = useAgentsStore(agentsSelectors.selectSelectedAgentId);
  const selectAgent = useAgentsStore((s) => s.selectAgent);

  if (agents.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-1 px-4 py-2">
      {agents.map((a) => {
        const active = a.id === selectedId;
        const label = `${a.emoji ?? ""} ${a.name ?? a.id}`.trim();
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => selectAgent(a.id)}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
