import { ScrollArea } from "@clawui/ui";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

export function PdfViewer({ dataUrl }: { dataUrl: string }) {
  const [numPages, setNumPages] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <ScrollArea className="h-full">
      <div ref={containerRef} className="p-2">
        <Document file={dataUrl} onLoadSuccess={({ numPages: n }) => setNumPages(n)}>
          {Array.from({ length: numPages }, (_, i) => (
            <Page key={i} pageNumber={i + 1} width={width - 16} />
          ))}
        </Document>
      </div>
    </ScrollArea>
  );
}
