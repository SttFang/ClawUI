import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAgentsStore, agentsSelectors } from "@/store/agents";
import { SkillsNetworkGraph } from "./skills/SkillsNetworkGraph";

export default function AgentSkills() {
  const { t } = useTranslation("common");
  const skillsError = useAgentsStore(agentsSelectors.selectSkillsError);
  const skills = useAgentsStore(agentsSelectors.selectSkills);
  const skillEntries = useAgentsStore(agentsSelectors.selectSkillEntries);

  if (skillsError) {
    return (
      <div className="p-3 text-sm text-destructive">
        {t("agents.skills.loadFailed")}: {skillsError}
      </div>
    );
  }

  if (!skills) {
    return (
      <div className="flex h-[500px] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-[500px]">
      <SkillsNetworkGraph skills={skillEntries} />
    </div>
  );
}
