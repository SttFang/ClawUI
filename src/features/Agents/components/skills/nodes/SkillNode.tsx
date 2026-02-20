import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

export type SkillNodeData = { label: string; color: string };
type SkillNodeType = Node<SkillNodeData, "skill">;

export function SkillNode({ data }: NodeProps<SkillNodeType>) {
  return (
    <div
      className="skill-node rounded-md border border-border/50 bg-card px-3 py-1.5 text-xs transition-all"
      style={{ "--glow-color": data.color } as React.CSSProperties}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <span className="text-foreground/80">{data.label}</span>
    </div>
  );
}
