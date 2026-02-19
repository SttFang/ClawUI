import { cn } from "@clawui/ui";
import { Loader2 } from "lucide-react";
import type { SubagentNode as SubagentNodeType } from "@/store/subagents";

interface SubagentNodeItemProps {
  node: SubagentNodeType;
  selected: boolean;
  onSelect: (runId: string) => void;
}

function StatusDot({ status }: { status: SubagentNodeType["status"] }) {
  const color = {
    spawning: "bg-yellow-400",
    running: "bg-blue-400 animate-pulse",
    done: "bg-green-500",
    error: "bg-red-500",
    timeout: "bg-orange-400",
  }[status];

  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", color)} />;
}

function formatDuration(start: number, end?: number): string {
  const ms = (end ?? Date.now()) - start;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60}s`;
}

export function SubagentNodeItem({ node, selected, onSelect }: SubagentNodeItemProps) {
  const isActive = node.status === "running" || node.status === "spawning";
  const taskLabel = node.task.length > 40 ? `${node.task.slice(0, 40)}…` : node.task;

  return (
    <button
      type="button"
      onClick={() => onSelect(node.runId)}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
        "hover:bg-muted/50",
        selected && "bg-muted",
      )}
    >
      {isActive ? (
        <Loader2 className="h-3 w-3 shrink-0 animate-spin text-blue-400" />
      ) : (
        <StatusDot status={node.status} />
      )}
      <span className="min-w-0 flex-1 truncate">{taskLabel}</span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatDuration(node.createdAt, node.endedAt)}
      </span>
    </button>
  );
}
