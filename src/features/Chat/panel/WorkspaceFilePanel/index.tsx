import { ScrollArea } from "@clawui/ui";
import { ExternalLink, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ipc } from "@/lib/ipc";
import { cn } from "@/lib/utils";
import { useWorkspaceFilesStore } from "@/store/workspaceFiles";
import { TextContent } from "./TextContent";
import { ImageContent, VideoContent, HtmlContent } from "./MediaContent";
import { OfficeContent } from "./OfficePreview";
import { PythonRunBar } from "./PythonRunBar";

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
    <div className="flex items-center border-b">
      <div className="flex flex-1 items-center gap-0 overflow-x-auto">
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
      {activeTabPath && (
        <button
          type="button"
          className="shrink-0 px-2 py-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => void ipc.workspace.openInSystem(activeTabPath)}
          aria-label={t("workspaceFiles.openInSystem")}
          title={t("workspaceFiles.openInSystem")}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
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
          ) : activeTab.kind === "video" ? (
            <VideoContent tab={activeTab} />
          ) : activeTab.kind === "html" ? (
            <HtmlContent tab={activeTab} />
          ) : activeTab.kind === "office" ? (
            <OfficeContent tab={activeTab} />
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
