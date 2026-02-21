import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import type { OpenTab } from "@/store/workspaceFiles";

export function ImageContent({ tab }: { tab: OpenTab }) {
  if (!tab.content) return null;
  return (
    <div className="flex h-full items-center justify-center overflow-hidden">
      <TransformWrapper initialScale={1} minScale={0.1} maxScale={10} centerOnInit>
        <TransformComponent
          wrapperClass="!w-full !h-full"
          contentClass="!w-full !h-full !flex !items-center !justify-center"
        >
          <img src={tab.content} alt={tab.name} className="max-h-full max-w-full object-contain" />
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}

export function VideoContent({ tab }: { tab: OpenTab }) {
  if (!tab.content) return null;
  return (
    <div className="flex h-full items-center justify-center bg-black p-4">
      <video controls className="max-h-full max-w-full" src={tab.content}>
        <track kind="captions" />
      </video>
    </div>
  );
}

export function HtmlContent({ tab }: { tab: OpenTab }) {
  if (!tab.content) return null;
  return (
    <iframe sandbox="" srcDoc={tab.content} title={tab.name} className="h-full w-full border-0" />
  );
}
