import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clawui/ui";
import { useTranslation } from "react-i18next";
import { useAgentsStore, agentsSelectors } from "@/store/agents";

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
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">{t("agents.skills.profileMain")}</div>
            <div className="mt-1 text-xs text-muted-foreground font-mono break-all">
              {skillsMain?.dir ?? "\u2014"}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(skillsMain?.skills ?? []).slice(0, 24).map((s) => (
                <span key={s} className="rounded-md border bg-muted px-2 py-1 text-xs">
                  {s}
                </span>
              ))}
              {(skillsMain?.skills?.length ?? 0) === 0 && (
                <span className="text-sm text-muted-foreground">{t("agents.skills.none")}</span>
              )}
            </div>
            {(skillsMain?.skills?.length ?? 0) > 24 && (
              <div className="mt-2 text-xs text-muted-foreground">
                {t("agents.skills.more", { count: (skillsMain?.skills?.length ?? 0) - 24 })}
              </div>
            )}
          </div>

          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">
              {t("agents.skills.profileConfigAgent")}
            </div>
            <div className="mt-1 text-xs text-muted-foreground font-mono break-all">
              {skillsConfigAgent?.dir ?? "\u2014"}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(skillsConfigAgent?.skills ?? []).slice(0, 24).map((s) => (
                <span key={s} className="rounded-md border bg-muted px-2 py-1 text-xs">
                  {s}
                </span>
              ))}
              {(skillsConfigAgent?.skills?.length ?? 0) === 0 && (
                <span className="text-sm text-muted-foreground">{t("agents.skills.none")}</span>
              )}
            </div>
            {(skillsConfigAgent?.skills?.length ?? 0) > 24 && (
              <div className="mt-2 text-xs text-muted-foreground">
                {t("agents.skills.more", {
                  count: (skillsConfigAgent?.skills?.length ?? 0) - 24,
                })}
              </div>
            )}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">{t("agents.skills.note")}</div>
      </CardContent>
    </Card>
  );
}
