import { Collapsible, CollapsibleContent, CollapsibleTrigger, ScrollArea } from "@clawui/ui";
import { ChevronRight, FileText, Folder, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useWorkspaceFilesStore } from "@/store/workspaceFiles";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function WorkspaceFileList() {
  const { t } = useTranslation("chat");
  const files = useWorkspaceFilesStore((s) => s.files);
  const currentPath = useWorkspaceFilesStore((s) => s.currentPath);
  const activeTabPath = useWorkspaceFilesStore((s) => s.activeTabPath);
  const loading = useWorkspaceFilesStore((s) => s.loading);
  const error = useWorkspaceFilesStore((s) => s.error);
  const openFile = useWorkspaceFilesStore((s) => s.openFile);
  const loadFiles = useWorkspaceFilesStore((s) => s.loadFiles);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const shouldAutoCollapse = !loading && !error && currentPath === "" && files.length === 0;
    if (shouldAutoCollapse) {
      setOpen(false);
    }
  }, [currentPath, error, files.length, loading]);

  const handleClick = (file: { name: string; isDirectory: boolean }) => {
    const relativePath = currentPath ? `${currentPath}/${file.name}` : file.name;
    if (file.isDirectory) {
      void loadFiles(relativePath);
    } else {
      void openFile(relativePath);
    }
  };

  const handleBack = () => {
    const parent = currentPath.includes("/")
      ? currentPath.slice(0, currentPath.lastIndexOf("/"))
      : "";
    void loadFiles(parent || undefined);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t">
      <div className="flex w-full items-center gap-1 px-4 py-2 text-xs font-medium text-muted-foreground">
        <CollapsibleTrigger className="flex flex-1 items-center gap-1 hover:text-foreground">
          <ChevronRight className="h-3 w-3 transition-transform [[data-state=open]>&]:rotate-90" />
          <span className="flex-1 text-left">{t("workspaceFiles.title")}</span>
        </CollapsibleTrigger>
        <button
          type="button"
          className="rounded p-0.5 hover:bg-muted hover:text-foreground"
          onClick={() => void loadFiles(currentPath || undefined)}
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
        </button>
      </div>

      <CollapsibleContent>
        <ScrollArea className="max-h-40">
          <div className="px-2 pb-2 space-y-0.5">
            {error && (
              <p className="px-2 text-xs text-destructive">{t("workspaceFiles.loadError")}</p>
            )}

            {currentPath && (
              <button
                type="button"
                onClick={handleBack}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-muted-foreground hover:bg-muted"
              >
                <ChevronRight className="h-3.5 w-3.5 shrink-0 rotate-180" />
                <span>..</span>
              </button>
            )}

            {!loading && files.length === 0 && !error && (
              <p className="px-2 text-xs text-muted-foreground">{t("workspaceFiles.empty")}</p>
            )}

            {files.map((file) => {
              const relativePath = currentPath ? `${currentPath}/${file.name}` : file.name;
              const Icon = file.isDirectory ? Folder : FileText;
              return (
                <button
                  key={file.name}
                  type="button"
                  onClick={() => handleClick(file)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted",
                    activeTabPath === relativePath && "bg-muted font-medium",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{file.name}</span>
                  {!file.isDirectory && (
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                      {formatSize(file.size)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  );
}
