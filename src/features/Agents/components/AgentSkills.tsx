import { useTranslation } from "react-i18next";
import { useAgentsStore, agentsSelectors } from "@/store/agents";
import { SkillsNetworkGraph } from "./skills/SkillsNetworkGraph";

export function AgentSkills() {
  const { t } = useTranslation("common");
  const skillsError = useAgentsStore(agentsSelectors.selectSkillsError);
  const skillsMain = useAgentsStore(agentsSelectors.selectSkillsMain);
  const skillsConfigAgent = useAgentsStore(agentsSelectors.selectSkillsConfigAgent);

  return (
    <div className="h-[500px]">
      {skillsError && (
        <div className="p-3 text-sm text-destructive">
          {t("agents.skills.loadFailed")}: {skillsError}
        </div>
      )}
      <SkillsNetworkGraph mainSkills={skillsMain} configAgentSkills={skillsConfigAgent} />
    </div>
  );
}
