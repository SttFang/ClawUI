import { Collapsible, CollapsibleContent, CollapsibleTrigger, Input, ScrollArea } from "@clawui/ui";
import { ChevronRight, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useWorkspaceFilesStore } from "@/store/workspaceFiles";
import { getFileIcon } from "./fileIcons";

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
  const [query, setQuery] = useState("");
  const prevPathRef = useRef(currentPath);

  useEffect(() => {
    const shouldAutoCollapse = !loading && !error && currentPath === "" && files.length === 0;
    if (shouldAutoCollapse) {
      setOpen(false);
    }
  }, [currentPath, error, files.length, loading]);

  // 切换目录时清空搜索
  useEffect(() => {
    if (prevPathRef.current !== currentPath) {
      prevPathRef.current = currentPath;
      setQuery("");
    }
  }, [currentPath]);

  const filtered = useMemo(() => {
    if (!query) return files;
    const q = query.toLowerCase();
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, query]);

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
    <Collapsible open={open} onOpenChange={setOpen} className="flex min-h-0 flex-1 flex-col">
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

      <CollapsibleContent className="min-h-0 flex-1 overflow-hidden">
        {files.length > 0 && (
          <div className="relative px-2 pt-1 pb-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("workspaceFiles.searchPlaceholder")}
              className="h-7 pl-7 text-xs"
            />
          </div>
        )}
        <ScrollArea className="h-full">
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

            {filtered.map((file) => {
              const relativePath = currentPath ? `${currentPath}/${file.name}` : file.name;
              const Icon = getFileIcon(file.name, file.isDirectory);
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

      {/* Collapsed state: bottom padding so header doesn't stick to panel edge */}
      {!open && <div className="pb-2" />}
    </Collapsible>
  );
}
