import { Button } from "@clawui/ui";
import { Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWorkspaceFilesStore } from "@/store/workspaceFiles";

export function PythonRunBar({ relativePath }: { relativePath: string }) {
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
