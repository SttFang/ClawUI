import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { WorkspaceFileEntry } from "@/lib/ipc";
import { ipc } from "@/lib/ipc";

export type { WorkspaceFileEntry };

type WorkspaceFilesState = {
  files: WorkspaceFileEntry[];
  /** Relative path currently being browsed (empty string = root) */
  currentPath: string;
  activeFilePath: string | null;
  fileContent: string | null;
  loading: boolean;
  error: string | null;
};

type WorkspaceFilesAction = {
  loadFiles: (subpath?: string) => Promise<void>;
  selectFile: (relativePath: string) => Promise<void>;
  closeFile: () => void;
};

type WorkspaceFilesStore = WorkspaceFilesState & WorkspaceFilesAction;

const initialState: WorkspaceFilesState = {
  files: [],
  currentPath: "",
  activeFilePath: null,
  fileContent: null,
  loading: false,
  error: null,
};

export const useWorkspaceFilesStore = create<WorkspaceFilesStore>()(
  devtools(
    (set) => ({
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

      selectFile: async (relativePath: string) => {
        set(
          { activeFilePath: relativePath, fileContent: null, loading: true, error: null },
          false,
          "selectFile/start",
        );
        try {
          const res = await ipc.workspace.readFile(relativePath);
          set({ fileContent: res.content, loading: false }, false, "selectFile/done");
        } catch (err) {
          set(
            { error: err instanceof Error ? err.message : String(err), loading: false },
            false,
            "selectFile/error",
          );
        }
      },

      closeFile: () => {
        set({ activeFilePath: null, fileContent: null, error: null }, false, "closeFile");
      },
    }),
    { name: "WorkspaceFilesStore" },
  ),
);
