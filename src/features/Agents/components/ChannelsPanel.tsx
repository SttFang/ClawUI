import { Button } from "@clawui/ui";
import { Cable } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useChannelsStore, selectChannels } from "@/store/channels";

export function ChannelsPanel() {
  const { t } = useTranslation("common");
  const channels = useChannelsStore(selectChannels);
  const configuredChannels = channels.filter((c) => c.isConfigured);
  const enabledCount = channels.filter((c) => c.isEnabled).length;

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-1 pb-3">
        <div className="text-sm text-muted-foreground">
          {t("agents.inputs.channelsStatus", {
            configured: configuredChannels.length,
            enabled: enabledCount,
          })}
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href="#/settings?tab=messaging">{t("agents.actions.manageChannels")}</a>
        </Button>
      </div>

      {configuredChannels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Cable className="size-8 mb-2 opacity-40" />
          <span className="text-sm">{t("agents.inputs.noChannels")}</span>
        </div>
      ) : (
        <div className="divide-y">
          {configuredChannels.map((c) => (
            <div
              key={c.type}
              className="flex items-center justify-between px-2 py-2 text-sm rounded-md hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2 truncate">
                <span>{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.type}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`size-1.5 rounded-full ${c.isEnabled ? "bg-green-500" : "bg-muted-foreground/40"}`}
                />
                <span className="text-xs text-muted-foreground">
                  {c.isEnabled ? t("agents.values.enabled") : t("agents.values.disabled")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
