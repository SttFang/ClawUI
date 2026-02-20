import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAgentsStore, agentsSelectors } from "@/store/agents";
import { SkillsNetworkGraph } from "./skills/SkillsNetworkGraph";

export default function AgentSkills() {
  const { t } = useTranslation("common");
  const skillsError = useAgentsStore(agentsSelectors.selectSkillsError);
  const skillEntries = useAgentsStore(agentsSelectors.selectSkillEntries);
  const loadSkills = useAgentsStore((s) => s.loadSkills);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  return (
    <div className="h-[500px]">
      {skillsError && (
        <div className="p-3 text-sm text-destructive">
          {t("agents.skills.loadFailed")}: {skillsError}
        </div>
      )}
      <SkillsNetworkGraph skills={skillEntries} />
    </div>
  );
}
