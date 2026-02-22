import { useTranslation } from "react-i18next";
import { formatTimestamp } from "@/routes/agents/cronFormat";
import { useAgentsStore, agentsSelectors } from "@/store/agents";
import { useChannelsStore, selectChannels } from "@/store/channels";
import { usePluginsStore, selectInstalledPlugins } from "@/store/plugins";

interface StatusBarProps {
  onTabChange: (tab: string) => void;
}

export function StatusBar({ onTabChange }: StatusBarProps) {
  const { t } = useTranslation("common");
  const skillEntries = useAgentsStore(agentsSelectors.selectSkillEntries);
  const cronStatus = useAgentsStore(agentsSelectors.selectCronStatus);
  const nodes = useAgentsStore(agentsSelectors.selectNodes);
  const channels = useChannelsStore(selectChannels);
  const installedPlugins = usePluginsStore(selectInstalledPlugins);

  const enabledChannels = channels.filter((c) => c.isEnabled).length;
  const configuredChannels = channels.filter((c) => c.isConfigured).length;
  const onlineNodes = nodes.filter((n) => n.connected).length;

  const items = [
    {
      tab: "skills",
      label: `Skills: ${skillEntries.length + installedPlugins.length}`,
    },
    {
      tab: "channels",
      label: `${t("agents.agentDesktop.tabs.channels")}: ${enabledChannels}/${configuredChannels}`,
    },
    {
      tab: "nodes",
      label: `${t("agents.agentDesktop.tabs.nodes")}: ${onlineNodes}`,
    },
    {
      tab: "cron",
      label: cronStatus?.nextWakeAtMs
        ? `\u23F0 ${formatTimestamp(cronStatus.nextWakeAtMs)}`
        : `\u23F0 \u2014`,
    },
  ];

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
      {items.map((item, i) => (
        <span key={item.tab} className="contents">
          {i > 0 && <span className="mx-1">&middot;</span>}
          <button
            className="hover:text-foreground transition-colors"
            onClick={() => onTabChange(item.tab)}
          >
            {item.label}
          </button>
        </span>
      ))}
    </div>
  );
}
