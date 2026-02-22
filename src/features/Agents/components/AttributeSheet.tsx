import { Button, Sheet, SheetContent, SheetHeader, SheetTitle } from "@clawui/ui";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { WorkspaceFileEntry } from "@/lib/ipc";
import { ipc } from "@/lib/ipc";
import { cn } from "@/lib/utils";
import { useToolsStore, selectToolsConfig } from "@/store/tools";
import type { AttributeType } from "./AgentHero";

interface AttributeSheetProps {
  type: AttributeType | null;
  onClose: () => void;
}

const titleKeys: Record<AttributeType, string> = {
  soul: "agents.agentDesktop.hero.soul.title",
  personality: "agents.agentDesktop.hero.personality.title",
  memory: "agents.agentDesktop.hero.memory.title",
  goals: "agents.agentDesktop.hero.goals.title",
  sandbox: "agents.agentDesktop.hero.sandbox.title",
};

const iconMap: Record<AttributeType, string> = {
  soul: "\u2728",
  personality: "\uD83E\uDDE0",
  memory: "\uD83D\uDCD6",
  goals: "\uD83C\uDFAF",
  sandbox: "\uD83D\uDEE1\uFE0F",
};

const fileMap: Record<string, string> = {
  soul: "SOUL.md",
  personality: "IDENTITY.md",
  goals: "TODO.agent.md",
};

export function AttributeSheet({ type, onClose }: AttributeSheetProps) {
  const { t } = useTranslation("common");
  const fileName = type ? fileMap[type] : undefined;

  return (
    <Sheet open={type !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent onClose={onClose} className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {type && `${iconMap[type]} ${t(titleKeys[type])}`}
            {fileName && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">— {fileName}</span>
            )}
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          {type === "soul" && <SoulContent />}
          {type === "personality" && <PersonalityContent />}
          {type === "memory" && <MemoryContent />}
          {type === "goals" && <GoalsContent />}
          {type === "sandbox" && <SandboxContent />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// --- Shared: read a workspace file and display as <pre> ---
function useWorkspaceFile(relativePath: string) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await ipc.workspace.readFile(relativePath);
      setContent(result.content ?? "");
    } catch (e) {
      setError(String(e));
    }
  }, [relativePath]);

  useEffect(() => {
    void load();
  }, [load]);

  return { content, error };
}

function WorkspaceFileView({ relativePath, emptyKey }: { relativePath: string; emptyKey: string }) {
  const { t } = useTranslation("common");
  const { content, error } = useWorkspaceFile(relativePath);

  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (content === null) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (!content) {
    return <div className="text-sm text-muted-foreground">{t(emptyKey)}</div>;
  }

  return (
    <pre className="whitespace-pre-wrap text-sm font-mono bg-muted rounded-md p-3 max-h-[60vh] overflow-auto">
      {content}
    </pre>
  );
}

function SoulContent() {
  return (
    <WorkspaceFileView relativePath="SOUL.md" emptyKey="agents.agentDesktop.hero.soul.summary" />
  );
}

function PersonalityContent() {
  return (
    <WorkspaceFileView
      relativePath="IDENTITY.md"
      emptyKey="agents.agentDesktop.hero.personality.empty"
    />
  );
}

function GoalsContent() {
  return (
    <WorkspaceFileView
      relativePath="TODO.agent.md"
      emptyKey="agents.agentDesktop.hero.goals.empty"
    />
  );
}

function MemoryContent() {
  const { t } = useTranslation("common");
  const [files, setFiles] = useState<WorkspaceFileEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  useEffect(() => {
    ipc.workspace
      .list("memory")
      .then((result) => {
        const mdFiles = result.files
          .filter((f) => !f.isDirectory && f.name.endsWith(".md"))
          .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setFiles(mdFiles);
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (files === null) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (files.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("agents.agentDesktop.hero.memory.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-1.5 max-h-40 overflow-auto">
        {files.map((f) => (
          <button
            key={f.name}
            type="button"
            className={cn(
              "flex items-center justify-between text-sm px-2.5 py-1.5 rounded-md text-left transition-colors",
              selectedFile === f.name ? "bg-accent text-accent-foreground" : "hover:bg-muted",
            )}
            onClick={() => setSelectedFile(f.name)}
          >
            <span className="truncate">{f.name}</span>
            <span className="text-xs text-muted-foreground shrink-0 ml-2">
              {new Date(f.updatedAtMs).toLocaleDateString()}
            </span>
          </button>
        ))}
      </div>
      {selectedFile && (
        <WorkspaceFileView
          relativePath={`memory/${selectedFile}`}
          emptyKey="agents.agentDesktop.hero.memory.empty"
        />
      )}
    </div>
  );
}

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
