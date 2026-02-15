import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@clawui/ui";
import { ChevronRight, FileText, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useWorkspaceFilesStore } from "@/store/workspaceFiles";

export function WorkspaceFileList() {
  const { t } = useTranslation("chat");
  const files = useWorkspaceFilesStore((s) => s.files);
  const activeFileName = useWorkspaceFilesStore((s) => s.activeFileName);
  const loading = useWorkspaceFilesStore((s) => s.loading);
  const error = useWorkspaceFilesStore((s) => s.error);
  const selectFile = useWorkspaceFilesStore((s) => s.selectFile);
  const loadFiles = useWorkspaceFilesStore((s) => s.loadFiles);

  return (
    <Collapsible defaultOpen className="border-t">
      <CollapsibleTrigger className="flex w-full items-center gap-1 px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ChevronRight className="h-3 w-3 transition-transform [[data-state=open]>&]:rotate-90" />
        <span className="flex-1 text-left">{t("workspaceFiles.title")}</span>
        <button
          type="button"
          className="rounded p-0.5 hover:bg-muted"
          onClick={(e) => {
            e.stopPropagation();
            void loadFiles();
          }}
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-2 pb-2 space-y-0.5">
          {error && (
            <p className="px-2 text-xs text-destructive">{t("workspaceFiles.loadError")}</p>
          )}

          {!loading && files.length === 0 && !error && (
            <p className="px-2 text-xs text-muted-foreground">{t("workspaceFiles.empty")}</p>
          )}

          {files.map((file) => (
            <button
              key={file.name}
              type="button"
              onClick={() => void selectFile(file.name)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted",
                activeFileName === file.name && "bg-muted font-medium",
              )}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{file.name}</span>
              {file.missing && (
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                  {t("workspaceFiles.missing")}
                </span>
              )}
            </button>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
