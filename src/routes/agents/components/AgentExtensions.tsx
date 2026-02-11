import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clawui/ui";
import { Boxes, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAgentsStore, agentsSelectors } from "@/store/agents";
import { usePluginsStore, selectInstalledPlugins } from "@/store/plugins";

export function AgentExtensions() {
  const { t } = useTranslation("common");
  const installedPlugins = usePluginsStore(selectInstalledPlugins);
  const skillsMain = useAgentsStore(agentsSelectors.selectSkillsMain);
  const skillsConfigAgent = useAgentsStore(agentsSelectors.selectSkillsConfigAgent);
  const totalSkills = new Set([...(skillsMain?.skills ?? []), ...(skillsConfigAgent?.skills ?? [])])
    .size;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Boxes className="w-5 h-5" />
              {t("agents.sections.extensions.title")}
            </CardTitle>
            <CardDescription>{t("agents.sections.extensions.description")}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="#/settings?tab=config&section=plugins">
                {t("agents.actions.managePlugins")}
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="#/settings?tab=config&section=skills">{t("agents.actions.manageSkills")}</a>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Wrench className="w-3.5 h-3.5" />
              {t("agents.extensions.plugins")}
            </div>
            <div className="font-medium">
              {t("agents.extensions.pluginsStatus", {
                installed: installedPlugins.length,
              })}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Boxes className="w-3.5 h-3.5" />
              {t("agents.extensions.skills")}
            </div>
            <div className="font-medium">
              {t("agents.extensions.skillsStatus", {
                count: totalSkills,
              })}
            </div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">{t("agents.extensions.note")}</div>
      </CardContent>
    </Card>
  );
}
