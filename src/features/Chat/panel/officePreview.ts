const DATA_URL_PATTERN = /^data:([^;,]+);base64,(.*)$/i;

export type OfficePreviewKind = "pdf" | "docx" | "pptx" | "xlsx" | "unsupported";

export function extOfFile(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function classifyOfficePreview(name: string): OfficePreviewKind {
  const ext = extOfFile(name);
  if (ext === ".pdf") return "pdf";
  if (ext === ".docx") return "docx";
  if (ext === ".pptx") return "pptx";
  if (ext === ".xlsx") return "xlsx";
  return "unsupported";
}

export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const matched = dataUrl.match(DATA_URL_PATTERN);
  if (!matched) {
    throw new Error("Invalid data URL");
  }

  const base64 = matched[2] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const matched = dataUrl.match(DATA_URL_PATTERN);
  if (!matched) {
    throw new Error("Invalid data URL");
  }
  const mime = matched[1] ?? "application/octet-stream";
  const bytes = dataUrlToUint8Array(dataUrl);
  const copied = Uint8Array.from(bytes);
  return new Blob([copied.buffer], { type: mime });
}

export function extractPptxSlideTextFromXml(xml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    return "";
  }

  const nodes = Array.from(doc.getElementsByTagNameNS("*", "t"));
  return nodes
    .map((node) => node.textContent?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
}

export async function extractPptxSlidesFromDataUrl(dataUrl: string): Promise<string[]> {
  const JSZip = (await import("jszip")).default;
  const bytes = dataUrlToUint8Array(dataUrl);
  const zip = await JSZip.loadAsync(bytes);

  const slideFiles = Object.keys(zip.files)
    .map((path) => ({ path, match: path.match(/^ppt\/slides\/slide(\d+)\.xml$/i) }))
    .filter((item): item is { path: string; match: RegExpMatchArray } => item.match !== null)
    .sort((a, b) => Number(a.match[1]) - Number(b.match[1]));

  const slides: string[] = [];
  for (const item of slideFiles) {
    const file = zip.file(item.path);
    if (!file) continue;
    const xml = await file.async("text");
    slides.push(extractPptxSlideTextFromXml(xml));
  }

  return slides;
}
