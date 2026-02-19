export type { WorkspaceFileEntry } from "@/lib/ipc";
export type { PythonRunResult } from "@/lib/ipc";

export type FileContentKind = "text" | "image" | "html" | "office";

export type OpenTab = {
  relativePath: string;
  name: string;
  kind: FileContentKind;
  content: string | null;
  loading: boolean;
  error: string | null;
};
