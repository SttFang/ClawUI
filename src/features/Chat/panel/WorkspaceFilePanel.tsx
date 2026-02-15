import { ScrollArea } from "@clawui/ui";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWorkspaceFilesStore } from "@/store/workspaceFiles";
import { MessageText } from "../components/MessageText";

function isMarkdownLike(name: string): boolean {
  return /\.(md|mdx|markdown)$/i.test(name);
}

export function WorkspaceFilePanel() {
  const { t } = useTranslation("chat");
  const activeFileName = useWorkspaceFilesStore((s) => s.activeFileName);
  const fileContent = useWorkspaceFilesStore((s) => s.fileContent);
  const loading = useWorkspaceFilesStore((s) => s.loading);
  const error = useWorkspaceFilesStore((s) => s.error);
  const closeFile = useWorkspaceFilesStore((s) => s.closeFile);

  if (!activeFileName) return null;

  return (
    <div className="flex w-96 shrink-0 flex-col border-l bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <span className="flex-1 truncate text-sm font-medium">{activeFileName}</span>
        <button
          type="button"
          onClick={closeFile}
          className="rounded p-1 hover:bg-muted"
          aria-label={t("workspaceFiles.close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          {loading && <p className="text-sm text-muted-foreground">...</p>}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {!loading &&
            !error &&
            fileContent != null &&
            (isMarkdownLike(activeFileName) ? (
              <MessageText text={fileContent} isAnimating={false} />
            ) : (
              <pre className="whitespace-pre-wrap break-words text-sm font-mono">{fileContent}</pre>
            ))}
        </div>
      </ScrollArea>
    </div>
  );
}
