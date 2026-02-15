import { BookOpen, Brain, Cable, ShieldCheck, Sparkles, Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAgentsStore, agentsSelectors } from "@/store/agents";
import { useChannelsStore, selectChannels } from "@/store/channels";
import { useToolsStore, selectToolsConfig } from "@/store/tools";
import { AttributeCard } from "./AttributeCard";
import { PixelAvatar } from "./PixelAvatar";

export type AttributeType = "soul" | "personality" | "channels" | "memory" | "goals" | "sandbox";

interface AgentHeroProps {
  onOpenAttribute: (type: AttributeType) => void;
}

export function AgentHero({ onOpenAttribute }: AgentHeroProps) {
  const { t } = useTranslation("common");
  const selectedAgent = useAgentsStore(agentsSelectors.selectSelectedAgent);
  const channels = useChannelsStore(selectChannels);
  const toolsConfig = useToolsStore(selectToolsConfig);

  const configuredChannels = channels.filter((c) => c.isConfigured);
  const sandboxStatus = toolsConfig.sandboxEnabled
    ? t("agents.values.enabled")
    : t("agents.values.disabled");

  const agentId = selectedAgent?.id ?? "main";

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      {/* Row 1: left attrs + avatar + right attrs */}
      <div className="flex items-center gap-3">
        <AttributeCard
          icon={<Sparkles className="h-3.5 w-3.5" />}
          title={t("agents.agentDesktop.hero.soul.title")}
          summary={t("agents.agentDesktop.hero.soul.summary")}
          onClick={() => onOpenAttribute("soul")}
        />
        <AttributeCard
          icon={<Brain className="h-3.5 w-3.5" />}
          title={t("agents.agentDesktop.hero.personality.title")}
          summary={t("agents.agentDesktop.hero.personality.summary")}
          onClick={() => onOpenAttribute("personality")}
        />

        <PixelAvatar agentId={agentId} />

        <AttributeCard
          icon={<BookOpen className="h-3.5 w-3.5" />}
          title={t("agents.agentDesktop.hero.memory.title")}
          summary={t("agents.agentDesktop.hero.memory.summary", { count: 0 })}
          onClick={() => onOpenAttribute("memory")}
        />
        <AttributeCard
          icon={<Target className="h-3.5 w-3.5" />}
          title={t("agents.agentDesktop.hero.goals.title")}
          summary={t("agents.agentDesktop.hero.goals.summary")}
          onClick={() => onOpenAttribute("goals")}
        />
      </div>

      {/* Row 2: channels + model info + sandbox */}
      <div className="flex items-center gap-3">
        <AttributeCard
          icon={<Cable className="h-3.5 w-3.5" />}
          title={t("agents.agentDesktop.hero.channels.title")}
          summary={t("agents.agentDesktop.hero.channels.summary", {
            count: configuredChannels.length,
          })}
          onClick={() => onOpenAttribute("channels")}
        />

        <div className="flex flex-col items-center justify-center w-24 text-center">
          <span className="text-xs font-mono text-muted-foreground truncate max-w-full">
            {selectedAgent?.modelPrimary ?? "—"}
          </span>
          <span className="text-[10px] text-muted-foreground">{sandboxStatus}</span>
        </div>

        <AttributeCard
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
          title={t("agents.agentDesktop.hero.sandbox.title")}
          summary={t("agents.agentDesktop.hero.sandbox.summary", {
            status: sandboxStatus,
          })}
          onClick={() => onOpenAttribute("sandbox")}
        />
      </div>
    </div>
  );
}
