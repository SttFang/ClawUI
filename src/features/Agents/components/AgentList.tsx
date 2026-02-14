import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clawui/ui";
import { Bot } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAgentsStore, agentsSelectors } from "@/store/agents";

export function AgentList() {
  const { t } = useTranslation("common");
  const agents = useAgentsStore(agentsSelectors.selectAgents);
  const selectedAgentId = useAgentsStore(agentsSelectors.selectSelectedAgentId);
  const selectAgent = useAgentsStore((s) => s.selectAgent);

  return (
    <Card className="h-fit">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <CardTitle>{t("agents.list.title")}</CardTitle>
        </div>
        <CardDescription>{t("agents.list.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {agents.length === 0 ? (
          <div className="text-sm text-muted-foreground">{t("agents.list.empty")}</div>
        ) : (
          agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => selectAgent(agent.id)}
              className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                selectedAgentId === agent.id
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{agent.id}</div>
                <span className="text-xs text-muted-foreground">{t("agents.list.defaultTag")}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {agent.modelPrimary ?? t("agents.list.unknownModel")}
              </div>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}
