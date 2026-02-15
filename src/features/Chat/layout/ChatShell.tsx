import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@clawui/ui";
import { useEffect, type ReactNode } from "react";
import { usePanelRef } from "react-resizable-panels";

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
        defaultSize={20}
        minSize="180px"
        maxSize={35}
      >
        {sidebar}
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel id="main" className="flex flex-col" minSize="300px" defaultSize={55}>
        {main}
      </ResizablePanel>
      <ResizableHandle disabled={!panel} />
      <ResizablePanel
        id="file-panel"
        className="flex flex-col"
        panelRef={filePanelRef}
        defaultSize={25}
        minSize="240px"
        maxSize={50}
        collapsible
        collapsedSize={0}
      >
        {panel}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
