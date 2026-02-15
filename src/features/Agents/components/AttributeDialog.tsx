import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@clawui/ui";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ipc } from "@/lib/ipc";
import { useChannelsStore, selectChannels } from "@/store/channels";
import { useToolsStore, selectToolsConfig } from "@/store/tools";
import type { AttributeType } from "./AgentHero";

interface AttributeDialogProps {
  type: AttributeType | null;
  onClose: () => void;
}

const titleKeys: Record<AttributeType, string> = {
  soul: "agents.agentDesktop.hero.soul.title",
  personality: "agents.agentDesktop.hero.personality.title",
  channels: "agents.agentDesktop.hero.channels.title",
  memory: "agents.agentDesktop.hero.memory.title",
  goals: "agents.agentDesktop.hero.goals.title",
  sandbox: "agents.agentDesktop.hero.sandbox.title",
};

export function AttributeDialog({ type, onClose }: AttributeDialogProps) {
  const { t } = useTranslation("common");

  return (
    <Dialog open={type !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent onClose={onClose} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{type ? t(titleKeys[type]) : ""}</DialogTitle>
        </DialogHeader>
        <div className="p-6 pt-4">
          {type === "soul" && <SoulContent />}
          {type === "channels" && <ChannelsContent />}
          {type === "sandbox" && <SandboxContent />}
          {type === "personality" && (
            <PlaceholderContent label={t("agents.agentDesktop.hero.personality.title")} />
          )}
          {type === "memory" && (
            <PlaceholderContent label={t("agents.agentDesktop.hero.memory.title")} />
          )}
          {type === "goals" && (
            <PlaceholderContent label={t("agents.agentDesktop.hero.goals.title")} />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("actions.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Soul: read SOUL.md ---
function SoulContent() {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await ipc.workspace.readFile("SOUL.md");
      setContent(
        typeof result === "string" ? result : ((result as { content?: string }).content ?? ""),
      );
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (content === null) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <pre className="whitespace-pre-wrap text-sm font-mono bg-muted rounded-md p-3 max-h-80 overflow-auto">
      {content || "(empty)"}
    </pre>
  );
}

// --- Channels ---
function ChannelsContent() {
  const { t } = useTranslation("common");
  const channels = useChannelsStore(selectChannels);
  const configuredChannels = channels.filter((c) => c.isConfigured);

  return (
    <div className="space-y-3">
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
      <Button variant="outline" size="sm" asChild>
        <a href="#/settings?tab=messaging">{t("agents.actions.manageChannels")}</a>
      </Button>
    </div>
  );
}

// --- Sandbox / Capabilities ---
function SandboxContent() {
  const { t } = useTranslation("common");
  const toolsConfig = useToolsStore(selectToolsConfig);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">{t("agents.tools.access")}</div>
          <div className="font-medium">{toolsConfig.accessMode}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">{t("agents.tools.sandbox")}</div>
          <div className="font-medium">
            {toolsConfig.sandboxEnabled ? t("agents.values.enabled") : t("agents.values.disabled")}
          </div>
        </div>
      </div>
      <div className="text-sm">
        <span className="text-muted-foreground">Policy: </span>
        allow {toolsConfig.allowList.length}, deny {toolsConfig.denyList.length}
      </div>
      <Button variant="outline" size="sm" asChild>
        <a href="#/settings?tab=capabilities&section=tools">{t("agents.actions.manageTools")}</a>
      </Button>
    </div>
  );
}

// --- Placeholder for not-yet-implemented attribute dialogs ---
function PlaceholderContent({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
      {label} — coming soon
    </div>
  );
}
