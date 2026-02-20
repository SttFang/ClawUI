import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

export type ProfileNodeData = { label: string; dir: string };
type ProfileNodeType = Node<ProfileNodeData, "profile">;

export function ProfileNode({ data }: NodeProps<ProfileNodeType>) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-5 py-3 shadow-lg">
      <div className="text-sm font-semibold text-foreground">{data.label}</div>
      <div className="mt-0.5 max-w-48 truncate text-[10px] font-mono text-muted-foreground">
        {data.dir}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  );
}
