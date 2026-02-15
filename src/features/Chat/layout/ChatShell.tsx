import type { ReactNode } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@clawui/ui";

export function ChatShell(props: { sidebar: ReactNode; main: ReactNode; panel?: ReactNode }) {
  const { sidebar, main, panel } = props;
  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      <ResizablePanel defaultSize={20} minSize="180px" maxSize={35}>
        {sidebar}
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel minSize="300px" defaultSize={panel ? 55 : 80}>
        {main}
      </ResizablePanel>
      {panel && (
        <>
          <ResizableHandle />
          <ResizablePanel defaultSize={25} minSize="240px" maxSize={50}>
            {panel}
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}
