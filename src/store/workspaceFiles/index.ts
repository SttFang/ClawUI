import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { PythonRunResult, WorkspaceFileEntry } from "@/lib/ipc";
import { ipc } from "@/lib/ipc";
import type { FileContentKind, OpenTab } from "./types";

export type { WorkspaceFileEntry, OpenTab, FileContentKind, PythonRunResult };

// --- File classification utilities ---

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".bmp"]);
const HTML_EXTS = new Set([".html", ".htm"]);

export function classifyFile(name: string): FileContentKind {
  const ext = extOf(name);
  if (IMAGE_EXTS.has(ext)) return "image";
  if (HTML_EXTS.has(ext)) return "html";
  return "text";
}

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
};

export function guessMimeType(name: string): string {
  return MIME_MAP[extOf(name)] ?? "application/octet-stream";
}

const LANG_MAP: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".jsx": "jsx",
  ".py": "python",
  ".json": "json",
  ".css": "css",
  ".html": "html",
  ".htm": "html",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".sql": "sql",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".rb": "ruby",
  ".lua": "lua",
  ".xml": "xml",
  ".svg": "xml",
};

export function guessLanguage(name: string): string | null {
  return LANG_MAP[extOf(name)] ?? null;
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function fileNameOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(i + 1) : path;
}

// --- Store ---

type WorkspaceFilesState = {
  files: WorkspaceFileEntry[];
  currentPath: string;
  openTabs: OpenTab[];
  activeTabPath: string | null;
  loading: boolean;
  error: string | null;
  pythonResult: PythonRunResult | null;
  pythonRunning: boolean;
};

type WorkspaceFilesAction = {
  loadFiles: (subpath?: string) => Promise<void>;
  openFile: (relativePath: string) => Promise<void>;
  closeTab: (relativePath: string) => void;
  setActiveTab: (relativePath: string) => void;
  closeAllTabs: () => void;
  runPython: (relativePath: string) => Promise<void>;
};

type WorkspaceFilesStore = WorkspaceFilesState & WorkspaceFilesAction;

const initialState: WorkspaceFilesState = {
  files: [],
  currentPath: "",
  openTabs: [],
  activeTabPath: null,
  loading: false,
  error: null,
  pythonResult: null,
  pythonRunning: false,
};

export const useWorkspaceFilesStore = create<WorkspaceFilesStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      loadFiles: async (subpath?: string) => {
        set({ loading: true, error: null }, false, "loadFiles/start");
        try {
          const res = await ipc.workspace.list(subpath);
          set(
            { files: res.files, currentPath: subpath ?? "", loading: false },
            false,
            "loadFiles/done",
          );
        } catch (err) {
          set(
            { error: err instanceof Error ? err.message : String(err), loading: false },
            false,
            "loadFiles/error",
          );
        }
      },

      openFile: async (relativePath: string) => {
        const { openTabs } = get();
        const existing = openTabs.find((t) => t.relativePath === relativePath);
        if (existing) {
          set({ activeTabPath: relativePath }, false, "openFile/switch");
          return;
        }

        const name = fileNameOf(relativePath);
        const kind = classifyFile(name);
        const tab: OpenTab = {
          relativePath,
          name,
          kind,
          content: null,
          loading: true,
          error: null,
        };

        set(
          { openTabs: [...openTabs, tab], activeTabPath: relativePath, pythonResult: null },
          false,
          "openFile/start",
        );

        try {
          let content: string;
          if (kind === "image") {
            const res = await ipc.workspace.readFileBase64(relativePath);
            content = `data:${guessMimeType(name)};base64,${res.base64}`;
          } else {
            const res = await ipc.workspace.readFile(relativePath);
            content = res.content;
          }
          set(
            (s) => ({
              openTabs: s.openTabs.map((t) =>
                t.relativePath === relativePath ? { ...t, content, loading: false } : t,
              ),
            }),
            false,
            "openFile/done",
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          set(
            (s) => ({
              openTabs: s.openTabs.map((t) =>
                t.relativePath === relativePath ? { ...t, error: msg, loading: false } : t,
              ),
            }),
            false,
            "openFile/error",
          );
        }
      },

      closeTab: (relativePath: string) => {
        const { openTabs, activeTabPath } = get();
        const idx = openTabs.findIndex((t) => t.relativePath === relativePath);
        if (idx < 0) return;

        const next = openTabs.filter((_, i) => i !== idx);
        let nextActive = activeTabPath;
        if (activeTabPath === relativePath) {
          const neighbor = next[Math.min(idx, next.length - 1)];
          nextActive = neighbor?.relativePath ?? null;
        }
        set({ openTabs: next, activeTabPath: nextActive, pythonResult: null }, false, "closeTab");
      },

      setActiveTab: (relativePath: string) => {
        set({ activeTabPath: relativePath, pythonResult: null }, false, "setActiveTab");
      },

      closeAllTabs: () => {
        set({ openTabs: [], activeTabPath: null, pythonResult: null }, false, "closeAllTabs");
      },

      runPython: async (relativePath: string) => {
        set({ pythonRunning: true, pythonResult: null }, false, "runPython/start");
        try {
          const result = await ipc.workspace.runPython(relativePath);
          set({ pythonResult: result, pythonRunning: false }, false, "runPython/done");
        } catch (err) {
          set(
            {
              pythonResult: {
                stdout: "",
                stderr: err instanceof Error ? err.message : String(err),
                exitCode: 1,
              },
              pythonRunning: false,
            },
            false,
            "runPython/error",
          );
        }
      },
    }),
    { name: "WorkspaceFilesStore" },
  ),
);
