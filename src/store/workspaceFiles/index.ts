import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { ipc } from "@/lib/ipc";
import { ensureChatConnected } from "@/services/chat/connection";
import type { AgentFileEntry } from "./types";

export type { AgentFileEntry };

type WorkspaceFilesState = {
  files: AgentFileEntry[];
  activeFileName: string | null;
  fileContent: string | null;
  loading: boolean;
  error: string | null;
};

type WorkspaceFilesAction = {
  loadFiles: () => Promise<void>;
  selectFile: (name: string) => Promise<void>;
  closeFile: () => void;
};

type WorkspaceFilesStore = WorkspaceFilesState & WorkspaceFilesAction;

const initialState: WorkspaceFilesState = {
  files: [],
  activeFileName: null,
  fileContent: null,
  loading: false,
  error: null,
};

export const useWorkspaceFilesStore = create<WorkspaceFilesStore>()(
  devtools(
    (set) => ({
      ...initialState,

      loadFiles: async () => {
        set({ loading: true, error: null }, false, "loadFiles/start");
        try {
          await ensureChatConnected();
          const res = (await ipc.chat.request("agents.files.list", { agentId: "main" })) as {
            files: AgentFileEntry[];
          };
          set({ files: res.files, loading: false }, false, "loadFiles/done");
        } catch (err) {
          set(
            { error: err instanceof Error ? err.message : String(err), loading: false },
            false,
            "loadFiles/error",
          );
        }
      },

      selectFile: async (name: string) => {
        set(
          { activeFileName: name, fileContent: null, loading: true, error: null },
          false,
          "selectFile/start",
        );
        try {
          await ensureChatConnected();
          const res = (await ipc.chat.request("agents.files.get", { agentId: "main", name })) as {
            file: { name: string; path: string; content: string };
          };
          set({ fileContent: res.file.content, loading: false }, false, "selectFile/done");
        } catch (err) {
          set(
            { error: err instanceof Error ? err.message : String(err), loading: false },
            false,
            "selectFile/error",
          );
        }
      },

      closeFile: () => {
        set({ activeFileName: null, fileContent: null, error: null }, false, "closeFile");
      },
    }),
    { name: "WorkspaceFilesStore" },
  ),
);
