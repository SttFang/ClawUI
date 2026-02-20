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
