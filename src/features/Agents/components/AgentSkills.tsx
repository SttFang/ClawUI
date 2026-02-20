import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clawui/ui";
import { useTranslation } from "react-i18next";
import { useAgentsStore, agentsSelectors } from "@/store/agents";
import { SkillsNetworkGraph } from "./skills/SkillsNetworkGraph";

export function AgentSkills() {
  const { t } = useTranslation("common");
  const skillsError = useAgentsStore(agentsSelectors.selectSkillsError);
  const skillsMain = useAgentsStore(agentsSelectors.selectSkillsMain);
  const skillsConfigAgent = useAgentsStore(agentsSelectors.selectSkillsConfigAgent);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("agents.sections.skills.title")}</CardTitle>
        <CardDescription>{t("agents.sections.skills.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {skillsError && (
          <div className="text-sm text-destructive">
            {t("agents.skills.loadFailed")}: {skillsError}
          </div>
        )}
        <div className="h-[500px] overflow-hidden">
          <SkillsNetworkGraph mainSkills={skillsMain} configAgentSkills={skillsConfigAgent} />
        </div>
        <div className="text-xs text-muted-foreground">{t("agents.skills.note")}</div>
      </CardContent>
    </Card>
  );
}
