import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@clawui/ui";
import { useEffect, type ReactNode } from "react";
import { usePanelRef } from "react-resizable-panels";

export const CHAT_LAYOUT_SIZES = {
  sidebar: {
    defaultSize: "20%",
    minSize: "180px",
    maxSize: "35%",
  },
  main: {
    defaultSize: "55%",
    minSize: "300px",
  },
  filePanel: {
    defaultSize: "25%",
    minSize: "240px",
    maxSize: "50%",
    collapsedSize: 0,
  },
} as const;

export function ChatShell(props: { sidebar: ReactNode; main: ReactNode; panel?: ReactNode }) {
  const { sidebar, main, panel } = props;
  const filePanelRef = usePanelRef();
  const hasPanel = panel != null;

  useEffect(() => {
    const handle = filePanelRef.current;
    if (!handle) return;
    if (hasPanel) {
      if (handle.isCollapsed()) handle.expand();
    } else {
      if (!handle.isCollapsed()) handle.collapse();
    }
  }, [hasPanel, filePanelRef]);

  return (
    <ResizablePanelGroup id="chat-layout" orientation="horizontal" className="h-full">
      <ResizablePanel
        id="sidebar"
        className="flex flex-col"
        defaultSize={CHAT_LAYOUT_SIZES.sidebar.defaultSize}
        minSize={CHAT_LAYOUT_SIZES.sidebar.minSize}
        maxSize={CHAT_LAYOUT_SIZES.sidebar.maxSize}
      >
        {sidebar}
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel
        id="main"
        className="flex flex-col"
        minSize={CHAT_LAYOUT_SIZES.main.minSize}
        defaultSize={CHAT_LAYOUT_SIZES.main.defaultSize}
      >
        {main}
      </ResizablePanel>
      <ResizableHandle disabled={!panel} />
      <ResizablePanel
        id="file-panel"
        className="flex flex-col"
        panelRef={filePanelRef}
        defaultSize={CHAT_LAYOUT_SIZES.filePanel.defaultSize}
        minSize={CHAT_LAYOUT_SIZES.filePanel.minSize}
        maxSize={CHAT_LAYOUT_SIZES.filePanel.maxSize}
        collapsible
        collapsedSize={CHAT_LAYOUT_SIZES.filePanel.collapsedSize}
      >
        {panel}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
