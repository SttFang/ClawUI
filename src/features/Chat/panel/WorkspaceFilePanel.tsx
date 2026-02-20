import { Button, ScrollArea } from "@clawui/ui";
import { Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { OpenTab } from "@/store/workspaceFiles";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { cn } from "@/lib/utils";
import { useWorkspaceFilesStore, guessLanguage } from "@/store/workspaceFiles";
import { MessageText } from "../components/MessageText";
import { classifyOfficePreview } from "./officePreview";

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
    <div className="flex h-full items-center justify-center overflow-hidden">
      <TransformWrapper
        initialScale={1}
        minScale={0.1}
        maxScale={10}
        centerOnInit
      >
        <TransformComponent
          wrapperClass="!w-full !h-full"
          contentClass="!w-full !h-full !flex !items-center !justify-center"
        >
          <img
            src={tab.content}
            alt={tab.name}
            className="max-h-full max-w-full object-contain"
          />
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}

function VideoContent({ tab }: { tab: OpenTab }) {
  if (!tab.content) return null;
  return (
    <div className="flex h-full items-center justify-center bg-black p-4">
      <video
        controls
        className="max-h-full max-w-full"
        src={tab.content}
      >
        <track kind="captions" />
      </video>
    </div>
  );
}

function HtmlContent({ tab }: { tab: OpenTab }) {
  if (!tab.content) return null;
  return (
    <iframe sandbox="" srcDoc={tab.content} title={tab.name} className="h-full w-full border-0" />
  );
}

function OfficeUnsupportedContent({ tab }: { tab: OpenTab }) {
  const { t } = useTranslation("chat");
  if (!tab.content) return null;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-sm font-medium">{t("workspaceFiles.officeUnsupported")}</p>
      <p className="text-xs text-muted-foreground">{t("workspaceFiles.officeUnsupportedHint")}</p>
      <a
        href={tab.content}
        download={tab.name}
        className="rounded-md border px-3 py-1.5 text-xs transition-colors hover:bg-muted"
      >
        {t("workspaceFiles.download")}
      </a>
    </div>
  );
}

function OfficeDocxContent({ tab }: { tab: OpenTab }) {
  const { t } = useTranslation("chat");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tab.content || !containerRef.current) return;

    let cancelled = false;
    const host = containerRef.current;
    host.innerHTML = "";
    setError(null);

    void (async () => {
      try {
        const [{ renderAsync }, { dataUrlToBlob }] = await Promise.all([
          import("docx-preview"),
          import("./officePreview"),
        ]);
        if (cancelled) return;
        const blob = dataUrlToBlob(tab.content!);
        await renderAsync(blob, host, host, {
          className: "docx-viewer",
          inWrapper: true,
          ignoreLastRenderedPageBreak: false,
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
      host.innerHTML = "";
    };
  }, [tab.content]);

  if (error) {
    return (
      <p className="p-4 text-sm text-destructive">
        {t("workspaceFiles.loadError")}: {error}
      </p>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <div ref={containerRef} />
      </div>
    </ScrollArea>
  );
}

function OfficePptxContent({ tab }: { tab: OpenTab }) {
  const { t } = useTranslation("chat");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tab.content || !containerRef.current) return;

    let cancelled = false;
    const host = containerRef.current;
    host.textContent = "";
    setError(null);

    void (async () => {
      try {
        const [pptxPreview, { dataUrlToUint8Array }] = await Promise.all([
          import("pptx-preview"),
          import("./officePreview"),
        ]);
        if (cancelled) return;
        const bytes = dataUrlToUint8Array(tab.content!);
        // pptx-preview may export as default or named - check actual export
        const render = typeof pptxPreview.default === "function" ? pptxPreview.default : pptxPreview;
        await (render as any)(bytes, {
          container: host,
          slideMode: "scroll",
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
      host.textContent = "";
    };
  }, [tab.content]);

  if (error) {
    return (
      <p className="p-4 text-sm text-destructive">
        {t("workspaceFiles.loadError")}: {error}
      </p>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <div ref={containerRef} />
      </div>
    </ScrollArea>
  );
}

function OfficeXlsxContent({ tab }: { tab: OpenTab }) {
  const { t } = useTranslation("chat");
  const [sheets, setSheets] = useState<{ name: string; rows: string[][] }[] | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tab.content) return;

    let cancelled = false;
    setSheets(null);
    setActiveSheet(0);
    setError(null);

    void (async () => {
      try {
        const { dataUrlToUint8Array } = await import("./officePreview");
        const ExcelJS = await import("exceljs");
        const bytes = dataUrlToUint8Array(tab.content!);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(bytes.buffer as ArrayBuffer);

        if (cancelled) return;

        const parsed: { name: string; rows: string[][] }[] = [];
        workbook.eachSheet((worksheet) => {
          const rows: string[][] = [];
          worksheet.eachRow((row) => {
            const cells: string[] = [];
            row.eachCell({ includeEmpty: true }, (cell) => {
              cells.push(cell.text ?? "");
            });
            rows.push(cells);
          });
          parsed.push({ name: worksheet.name, rows });
        });
        setSheets(parsed);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tab.content]);

  if (error) {
    return (
      <p className="p-4 text-sm text-destructive">
        {t("workspaceFiles.loadError")}: {error}
      </p>
    );
  }

  if (sheets == null) {
    return <p className="p-4 text-sm text-muted-foreground">{t("workspaceFiles.officeLoading")}</p>;
  }

  const current = sheets[activeSheet];

  return (
    <div className="flex h-full flex-col">
      {sheets.length > 1 && (
        <div className="flex gap-0 overflow-x-auto border-b">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              type="button"
              className={cn(
                "shrink-0 px-3 py-1.5 text-xs cursor-pointer select-none border-r",
                i === activeSheet
                  ? "bg-background text-foreground font-medium"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
              onClick={() => setActiveSheet(i)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        {current && current.rows.length > 0 ? (
          <table className="w-full border-collapse text-xs">
            <tbody>
              {current.rows.map((row, ri) => (
                <tr key={ri} className={ri === 0 ? "bg-muted/50 font-medium" : "border-t"}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border-r px-2 py-1 whitespace-nowrap">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">{t("workspaceFiles.sheetEmpty")}</p>
        )}
      </ScrollArea>
    </div>
  );
}

function OfficeContent({ tab }: { tab: OpenTab }) {
  if (!tab.content) return null;

  const kind = classifyOfficePreview(tab.name);
  if (kind === "pdf") {
    return <iframe src={tab.content} title={tab.name} className="h-full w-full border-0" />;
  }
  if (kind === "docx") {
    return <OfficeDocxContent tab={tab} />;
  }
  if (kind === "pptx") {
    return <OfficePptxContent tab={tab} />;
  }
  if (kind === "xlsx") {
    return <OfficeXlsxContent tab={tab} />;
  }
  return <OfficeUnsupportedContent tab={tab} />;
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
