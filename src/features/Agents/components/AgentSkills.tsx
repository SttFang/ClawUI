import { Button } from "@clawui/ui";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAgentsStore, agentsSelectors } from "@/store/agents";
import { usePluginsStore, selectInstalledPlugins } from "@/store/plugins";
import { SkillsNetworkGraph } from "./skills/SkillsNetworkGraph";

export default function AgentSkills() {
  const { t } = useTranslation("common");
  const skillsError = useAgentsStore(agentsSelectors.selectSkillsError);
  const skills = useAgentsStore(agentsSelectors.selectSkills);
  const skillEntries = useAgentsStore(agentsSelectors.selectSkillEntries);
  const installedPlugins = usePluginsStore(selectInstalledPlugins);

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
    <div className="flex flex-col h-[540px]">
      <div className="flex items-center justify-between px-1 pb-3">
        <div className="text-sm text-muted-foreground">
          {t("agents.extensions.skillsStatus", { count: skillEntries.length })}
          {" · "}
          {t("agents.extensions.pluginsStatus", { installed: installedPlugins.length })}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="#/settings?tab=capabilities&section=plugins">
              {t("agents.actions.managePlugins")}
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="#/settings?tab=capabilities&section=skills">
              {t("agents.actions.manageSkills")}
            </a>
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <SkillsNetworkGraph skills={skillEntries} />
      </div>
    </div>
  );
}
