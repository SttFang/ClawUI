import { Button } from "@clawui/ui";
import { Cable } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useChannelsStore, selectChannels } from "@/store/channels";
import { EmptyState } from "./EmptyState";

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
        <EmptyState
          icon={<Cable className="size-10" />}
          title={t("agents.inputs.noChannels")}
          description="连接 Telegram、Discord 等平台，让 Agent 在多个渠道响应消息"
          actionLabel={t("agents.actions.manageChannels")}
          onAction={() => {
            window.location.hash = "/settings?tab=messaging";
          }}
        />
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
