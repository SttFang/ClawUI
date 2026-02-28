import type { ChatStreamEvent } from "@/lib/ipc";
import { ipc } from "@/lib/ipc";
import { useWorkspaceFilesStore } from ".";

let initialized = false;

export function initWorkspaceFilesListener() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  ipc.chat.onStream((event: ChatStreamEvent) => {
    if (event.type !== "end") return;

    const store = useWorkspaceFilesStore.getState();
    const prevNames = new Set(store.files.map((f) => f.name));

    void store.loadFiles(store.currentPath || undefined).then(() => {
      const next = useWorkspaceFilesStore.getState();
      const newFile = next.files.find((f) => !f.isDirectory && !prevNames.has(f.name));
      if (newFile) {
        const path = next.currentPath ? `${next.currentPath}/${newFile.name}` : newFile.name;
        void next.openFile(path);
      }
    });
  });
}
