import { Button, ScrollArea } from "@clawui/ui";
import { Play, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { OpenTab } from "@/store/workspaceFiles";
import { cn } from "@/lib/utils";
import { useWorkspaceFilesStore, guessLanguage } from "@/store/workspaceFiles";
import { MessageText } from "../components/MessageText";

function isMarkdownLike(name: string): boolean {
  return /\.(md|mdx|markdown)$/i.test(name);
}

function isPython(name: string): boolean {
  return /\.py$/i.test(name);
}

// --- Tab Bar ---

function TabBar() {
  const { t } = useTranslation("chat");
  const openTabs = useWorkspaceFilesStore((s) => s.openTabs);
  const activeTabPath = useWorkspaceFilesStore((s) => s.activeTabPath);
  const setActiveTab = useWorkspaceFilesStore((s) => s.setActiveTab);
  const closeTab = useWorkspaceFilesStore((s) => s.closeTab);

  return (
    <div className="flex items-center gap-0 overflow-x-auto border-b">
      {openTabs.map((tab) => (
        <div
          key={tab.relativePath}
          className={cn(
            "group flex shrink-0 items-center gap-1 border-r px-3 py-1.5 text-xs cursor-pointer select-none",
            activeTabPath === tab.relativePath
              ? "bg-background text-foreground"
              : "bg-muted/50 text-muted-foreground hover:bg-muted",
          )}
          onClick={() => setActiveTab(tab.relativePath)}
          onKeyDown={(e) => e.key === "Enter" && setActiveTab(tab.relativePath)}
          role="tab"
          tabIndex={0}
          aria-selected={activeTabPath === tab.relativePath}
        >
          <span className="max-w-32 truncate">{tab.name}</span>
          <button
            type="button"
            className="rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/20"
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.relativePath);
            }}
            aria-label={t("workspaceFiles.close")}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

// --- Content renderers ---

function TextContent({ tab }: { tab: OpenTab }) {
  if (tab.content == null) return null;

  if (isMarkdownLike(tab.name)) {
    return <MessageText text={tab.content} isAnimating={false} />;
  }

  const lang = guessLanguage(tab.name);
  if (lang) {
    const fenced = `\`\`\`${lang}\n${tab.content}\n\`\`\``;
    return <MessageText text={fenced} isAnimating={false} />;
  }

  return <pre className="whitespace-pre-wrap break-words text-sm font-mono">{tab.content}</pre>;
}

function ImageContent({ tab }: { tab: OpenTab }) {
  if (!tab.content) return null;
  return (
    <div className="flex items-center justify-center p-4">
      <img src={tab.content} alt={tab.name} className="max-h-full max-w-full object-contain" />
    </div>
  );
}

function HtmlContent({ tab }: { tab: OpenTab }) {
  if (!tab.content) return null;
  return (
    <iframe sandbox="" srcDoc={tab.content} title={tab.name} className="h-full w-full border-0" />
  );
}

// --- Python Run Bar ---

function PythonRunBar({ relativePath }: { relativePath: string }) {
  const { t } = useTranslation("chat");
  const pythonRunning = useWorkspaceFilesStore((s) => s.pythonRunning);
  const pythonResult = useWorkspaceFilesStore((s) => s.pythonResult);
  const runPython = useWorkspaceFilesStore((s) => s.runPython);

  return (
    <div className="border-t">
      <div className="flex items-center gap-2 px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={pythonRunning}
          onClick={() => void runPython(relativePath)}
          className="h-7 gap-1 text-xs"
        >
          <Play className="h-3 w-3" />
          {pythonRunning ? t("workspaceFiles.running") : t("workspaceFiles.runPython")}
        </Button>
      </div>
      {pythonResult && (
        <div className="space-y-1 px-3 pb-2">
          {pythonResult.stdout && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground">
                {t("workspaceFiles.stdout")}
              </p>
              <pre className="rounded bg-muted p-2 text-xs font-mono whitespace-pre-wrap">
                {pythonResult.stdout}
              </pre>
            </div>
          )}
          {pythonResult.stderr && (
            <div>
              <p className="text-[10px] font-medium text-destructive">
                {t("workspaceFiles.stderr")}
              </p>
              <pre className="rounded bg-destructive/10 p-2 text-xs font-mono text-destructive whitespace-pre-wrap">
                {pythonResult.stderr}
              </pre>
            </div>
          )}
          {!pythonResult.stdout && !pythonResult.stderr && (
            <p className="text-xs text-muted-foreground">{t("workspaceFiles.noOutput")}</p>
          )}
          <p className="text-[10px] text-muted-foreground">
            {t("workspaceFiles.exitCode")}: {pythonResult.exitCode}
          </p>
        </div>
      )}
    </div>
  );
}

// --- Main Panel ---

export function WorkspaceFilePanel() {
  const openTabs = useWorkspaceFilesStore((s) => s.openTabs);
  const activeTabPath = useWorkspaceFilesStore((s) => s.activeTabPath);

  if (openTabs.length === 0) return null;

  const activeTab = openTabs.find((t) => t.relativePath === activeTabPath);
  if (!activeTab) return null;

  return (
    <div className="flex h-full flex-col bg-card">
      <TabBar />

      <div className="min-h-0 flex-1">
        {activeTab.loading && <p className="p-4 text-sm text-muted-foreground">...</p>}

        {activeTab.error && <p className="p-4 text-sm text-destructive">{activeTab.error}</p>}

        {!activeTab.loading &&
          !activeTab.error &&
          activeTab.content != null &&
          (activeTab.kind === "image" ? (
            <ImageContent tab={activeTab} />
          ) : activeTab.kind === "html" ? (
            <HtmlContent tab={activeTab} />
          ) : (
            <ScrollArea className="h-full">
              <div className="p-4">
                <TextContent tab={activeTab} />
              </div>
            </ScrollArea>
          ))}
      </div>

      {isPython(activeTab.name) && <PythonRunBar relativePath={activeTab.relativePath} />}
    </div>
  );
}
