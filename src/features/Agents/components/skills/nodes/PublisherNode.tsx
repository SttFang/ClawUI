import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

export type PublisherNodeData = { label: string; count: number; color: string };
type PublisherNodeType = Node<PublisherNodeData, "publisher">;

export function PublisherNode({ data }: NodeProps<PublisherNodeType>) {
  return (
    <div
      className="publisher-node rounded-lg border px-4 py-2"
      style={{ "--glow-color": data.color, borderColor: data.color } as React.CSSProperties}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-foreground">{data.label}</span>
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
          style={{ backgroundColor: data.color }}
        >
          {data.count}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  );
}
