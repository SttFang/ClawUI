import { ScrollArea } from "@clawui/ui";
import * as pdfjsLib from "pdfjs-dist";
import { TextLayer } from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "./pdf-text-layer.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function PdfViewer({ dataUrl }: { dataUrl: string }) {
  const { t } = useTranslation("chat");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageInfo, setPageInfo] = useState("");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    const textLayers: TextLayer[] = [];
    el.textContent = "";
    setError(null);
    setPageInfo("");

    void (async () => {
      try {
        const data = dataUrlToUint8Array(dataUrl);
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        if (cancelled) return;

        setPageInfo(`${pdf.numPages} ${pdf.numPages === 1 ? "page" : "pages"}`);
        const dpr = window.devicePixelRatio || 1;
        const cssWidth = el.clientWidth - 32; // account for padding

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          if (cancelled) return;

          const unscaled = page.getViewport({ scale: 1 });
          const scale = cssWidth / unscaled.width;
          const viewport = page.getViewport({ scale });

          // Page wrapper
          const wrapper = document.createElement("div");
          wrapper.className = "pdf-page-wrapper";
          wrapper.style.cssText =
            "background:#fff;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);overflow:hidden;position:relative;";

          // Canvas layer
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          canvas.style.display = "block";

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          ctx.scale(dpr, dpr);

          await page.render({ canvasContext: ctx, canvas, viewport }).promise;
          if (cancelled) return;

          wrapper.appendChild(canvas);

          // Text layer for selection support
          const textContent = await page.getTextContent();
          if (cancelled) return;

          const textLayerDiv = document.createElement("div");
          textLayerDiv.className = "textLayer";
          textLayerDiv.style.cssText = `position:absolute;top:0;left:0;width:${Math.floor(viewport.width)}px;height:${Math.floor(viewport.height)}px;overflow:clip;opacity:1;line-height:1;`;

          wrapper.appendChild(textLayerDiv);

          const tl = new TextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport,
          });
          textLayers.push(tl);
          await tl.render();

          // Page number label
          const label = document.createElement("div");
          label.textContent = `${i} / ${pdf.numPages}`;
          label.style.cssText = "text-align:center;padding:4px 0;font-size:11px;color:#888;";
          wrapper.appendChild(label);

          el.appendChild(wrapper);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
      for (const tl of textLayers) tl.cancel();
      el.textContent = "";
    };
  }, [dataUrl]);

  if (error) {
    return (
      <p className="p-4 text-sm text-destructive">
        {t("workspaceFiles.loadError")}: {error}
      </p>
    );
  }

  return (
    <ScrollArea className="h-full">
      {pageInfo && (
        <div className="border-b px-4 py-1.5 text-xs text-muted-foreground">{pageInfo}</div>
      )}
      <div ref={containerRef} className="flex flex-col items-center gap-4 bg-muted/30 p-4" />
    </ScrollArea>
  );
}
