import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clawui/ui";
import { useTranslation } from "react-i18next";
import { useAgentsStore, agentsSelectors } from "@/store/agents";

export function AgentIdentity() {
  const { t } = useTranslation("common");
  const selectedAgent = useAgentsStore(agentsSelectors.selectSelectedAgent);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("agents.sections.identity.title")}</CardTitle>
        <CardDescription>{t("agents.sections.identity.description")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
          <div className="text-muted-foreground">{t("agents.fields.agentId")}</div>
          <div className="font-mono">{selectedAgent?.id ?? "-"}</div>
        </div>
        <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
          <div className="text-muted-foreground">{t("agents.fields.modelPrimary")}</div>
          <div className="font-mono">
            {selectedAgent?.modelPrimary ?? t("agents.values.notConfigured")}
          </div>
        </div>
        <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
          <div className="text-muted-foreground">{t("agents.fields.modelFallbacks")}</div>
          <div className="font-mono">
            {selectedAgent?.modelFallbacks?.length
              ? selectedAgent.modelFallbacks.join(", ")
              : t("agents.values.none")}
          </div>
        </div>
        <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
          <div className="text-muted-foreground">{t("agents.fields.workspace")}</div>
          <div className="font-mono">
            {selectedAgent?.workspace ?? t("agents.values.notConfigured")}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
