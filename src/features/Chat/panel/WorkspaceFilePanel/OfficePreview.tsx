import { ScrollArea } from "@clawui/ui";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { OpenTab } from "@/store/workspaceFiles";
import { cn } from "@/lib/utils";
import { classifyOfficePreview } from "../officePreview";
import { PdfViewer } from "./PdfViewer";

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
    host.textContent = "";
    setError(null);

    void (async () => {
      try {
        const [{ renderAsync }, { dataUrlToBlob }] = await Promise.all([
          import("docx-preview"),
          import("../officePreview"),
        ]);
        if (cancelled) return;
        const blob = dataUrlToBlob(tab.content!);
        await renderAsync(blob, host, host, {
          className: "docx-viewer",
          inWrapper: false,
          ignoreWidth: true,
          ignoreHeight: true,
          breakPages: false,
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
      <div className="docx-flow-content p-2">
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
          import("../officePreview"),
        ]);
        if (cancelled) return;
        const bytes = dataUrlToUint8Array(tab.content!);
        // pptx-preview may export as default or named - check actual export
        const render =
          typeof pptxPreview.default === "function" ? pptxPreview.default : pptxPreview;
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
        const { dataUrlToUint8Array } = await import("../officePreview");
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

      <div className="min-h-0 flex-1 overflow-auto">
        {current && current.rows.length > 0 ? (
          <table className="border-collapse text-xs">
            <thead>
              <tr className="bg-muted/50 font-medium sticky top-0">
                {(current.rows[0] ?? []).map((cell, ci) => (
                  <th
                    key={ci}
                    className="border-b border-r px-2 py-1.5 text-left font-medium whitespace-nowrap"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {current.rows.slice(1).map((row, ri) => (
                <tr key={ri} className="border-t">
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
      </div>
    </div>
  );
}

export function OfficeContent({ tab }: { tab: OpenTab }) {
  if (!tab.content) return null;

  const kind = classifyOfficePreview(tab.name);
  if (kind === "pdf") {
    return <PdfViewer dataUrl={tab.content} />;
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
