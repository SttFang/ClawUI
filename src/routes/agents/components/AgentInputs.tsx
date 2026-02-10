import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clawui/ui";
import { Cable } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useChannelsStore, selectChannels } from "@/store/channels";

export function AgentInputs() {
  const { t } = useTranslation("common");
  const channels = useChannelsStore(selectChannels);
  const configuredChannels = channels.filter((c) => c.isConfigured);
  const enabledChannels = channels.filter((c) => c.isEnabled);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Cable className="w-5 h-5" />
              {t("agents.sections.inputs.title")}
            </CardTitle>
            <CardDescription>{t("agents.sections.inputs.description")}</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="#/channels">{t("agents.actions.manageChannels")}</a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm">
          <span className="text-muted-foreground">{t("agents.inputs.channels")}: </span>
          <span>
            {t("agents.inputs.channelsStatus", {
              configured: configuredChannels.length,
              enabled: enabledChannels.length,
            })}
          </span>
        </div>
        <div className="grid gap-2">
          {channels
            .filter((c) => c.isConfigured)
            .map((c) => (
              <div key={c.type} className="flex items-center justify-between text-sm">
                <div className="truncate">
                  {c.name}
                  <span className="ml-2 text-xs text-muted-foreground">{c.type}</span>
                </div>
                <div className={c.isEnabled ? "text-green-600" : "text-muted-foreground"}>
                  {c.isEnabled ? t("agents.values.enabled") : t("agents.values.disabled")}
                </div>
              </div>
            ))}
          {configuredChannels.length === 0 && (
            <div className="text-sm text-muted-foreground">{t("agents.inputs.noChannels")}</div>
          )}
        </div>
        <div className="text-xs text-muted-foreground">{t("agents.inputs.bindingsNote")}</div>
      </CardContent>
    </Card>
  );
}
