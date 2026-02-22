import { BookOpen, Brain, Sparkles, Target } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ipc } from "@/lib/ipc";
import { useAgentsStore, agentsSelectors } from "@/store/agents";
import { useToolsStore, selectToolsConfig } from "@/store/tools";
import { AttributeCard } from "./AttributeCard";
import { PixelAvatar } from "./PixelAvatar";

export type AttributeType = "soul" | "personality" | "memory" | "goals" | "sandbox";

interface AgentHeroProps {
  onOpenAttribute: (type: AttributeType) => void;
  memoryCount: number;
}

/** Read first 2 lines of a workspace file for preview */
function useFilePreview(relativePath: string) {
  const [preview, setPreview] = useState<string | undefined>();

  const load = useCallback(async () => {
    try {
      const result = await ipc.workspace.readFile(relativePath);
      if (result.content) {
        const lines = result.content.split("\n").filter(Boolean);
        setPreview(lines.slice(0, 2).join(" ").slice(0, 80));
      }
    } catch {
      // file doesn't exist yet — no preview
    }
  }, [relativePath]);

  useEffect(() => {
    void load();
  }, [load]);

  return preview;
}

export function AgentHero({ onOpenAttribute, memoryCount }: AgentHeroProps) {
  const { t } = useTranslation("common");
  const selectedAgent = useAgentsStore(agentsSelectors.selectSelectedAgent);
  const toolsConfig = useToolsStore(selectToolsConfig);

  const sandboxStatus = toolsConfig.sandboxEnabled
    ? t("agents.values.enabled")
    : t("agents.values.disabled");

  const agentId = selectedAgent?.id ?? "main";
  const model = selectedAgent?.modelPrimary ?? "\u2014";

  const soulPreview = useFilePreview("SOUL.md");
  const personalityPreview = useFilePreview("IDENTITY.md");
  const goalsPreview = useFilePreview("TODO.agent.md");

  return (
    <div className="flex flex-col gap-4 py-4">
      {/* Identity bar */}
      <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
        <PixelAvatar agentId={agentId} className="w-12 h-12" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{agentId}</div>
          <div className="text-xs text-muted-foreground">
            {model}
            <span className="mx-1.5">&middot;</span>
            {t("agents.agentDesktop.hero.sandbox.title")} {sandboxStatus}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="size-2 rounded-full bg-green-500" />
          <span className="text-xs text-muted-foreground">
            {t("agents.agentDesktop.nodes.online")}
          </span>
        </div>
      </div>

      {/* Attribute cards grid */}
      <div className="grid grid-cols-4 gap-3">
        <AttributeCard
          icon={<Sparkles className="h-3.5 w-3.5" />}
          title={t("agents.agentDesktop.hero.soul.title")}
          preview={soulPreview}
          fileName="SOUL.md"
          onClick={() => onOpenAttribute("soul")}
        />
        <AttributeCard
          icon={<Brain className="h-3.5 w-3.5" />}
          title={t("agents.agentDesktop.hero.personality.title")}
          preview={personalityPreview}
          fileName="IDENTITY.md"
          onClick={() => onOpenAttribute("personality")}
        />
        <AttributeCard
          icon={<BookOpen className="h-3.5 w-3.5" />}
          title={t("agents.agentDesktop.hero.memory.title")}
          preview={
            memoryCount > 0
              ? t("agents.agentDesktop.hero.memory.summary", {
                  count: memoryCount,
                })
              : undefined
          }
          fileName="memory/"
          onClick={() => onOpenAttribute("memory")}
        />
        <AttributeCard
          icon={<Target className="h-3.5 w-3.5" />}
          title={t("agents.agentDesktop.hero.goals.title")}
          preview={goalsPreview}
          fileName="TODO.agent.md"
          onClick={() => onOpenAttribute("goals")}
        />
      </div>
    </div>
  );
}
