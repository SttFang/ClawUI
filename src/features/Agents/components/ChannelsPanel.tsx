import { Button, Card, CardContent, CardHeader, CardTitle } from "@clawui/ui";
import { Cable } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useChannelsStore, selectChannels } from "@/store/channels";

export function ChannelsPanel() {
  const { t } = useTranslation("common");
  const channels = useChannelsStore(selectChannels);
  const configuredChannels = channels.filter((c) => c.isConfigured);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Cable className="w-5 h-5" />
            {t("agents.agentDesktop.tabs.channels")}
          </CardTitle>
          <Button variant="outline" size="sm" asChild>
            <a href="#/settings?tab=messaging">{t("agents.actions.manageChannels")}</a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">
          {t("agents.inputs.channelsStatus", {
            configured: configuredChannels.length,
            enabled: channels.filter((c) => c.isEnabled).length,
          })}
        </div>
        <div className="grid gap-2">
          {configuredChannels.map((c) => (
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
      </CardContent>
    </Card>
  );
}
