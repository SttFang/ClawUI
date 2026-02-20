import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  type NodeTypes,
  type NodeMouseHandler,
} from "@xyflow/react";
import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import "@xyflow/react/dist/style.css";
import "./skills-graph.css";
import type { SkillEntry } from "@/lib/ipc";
import { PublisherNode } from "./nodes/PublisherNode";
import { SkillNode, type SkillNodeData } from "./nodes/SkillNode";
import { useSkillsGraph } from "./useSkillsGraph";

const nodeTypes: NodeTypes = {
  publisher: PublisherNode,
  skill: SkillNode,
};

interface Props {
  skills: SkillEntry[];
}

export function SkillsNetworkGraph({ skills }: Props) {
  const { nodes: initialNodes, edges: initialEdges } = useSkillsGraph(skills);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selected, setSelected] = useState<SkillNodeData | null>(null);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const onNodeClick: NodeMouseHandler = useCallback((_evt, node) => {
    if (node.type === "skill") setSelected(node.data as SkillNodeData);
  }, []);

  const noop = useCallback(() => {}, []);

  if (initialNodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No skills loaded
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={noop}
      onNodeClick={onNodeClick}
      onPaneClick={() => setSelected(null)}
      nodeTypes={nodeTypes}
      fitView
      proOptions={{ hideAttribution: true }}
      nodesDraggable
      nodesConnectable={false}
      className="bg-background"
    >
      <Background gap={16} size={1} className="opacity-30" />
      <Controls showInteractive={false} />
      {selected && (
        <Panel position="top-right">
          <div
            className="w-56 rounded-lg bg-card/95 p-3 shadow-lg backdrop-blur-sm"
            style={{ borderLeft: `3px solid ${selected.color}` }}
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-semibold text-foreground">{selected.label}</span>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: selected.color }} />
              <span className="text-[10px] text-muted-foreground">{selected.publisher}</span>
            </div>
            {selected.description && (
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                {selected.description}
              </p>
            )}
          </div>
        </Panel>
      )}
    </ReactFlow>
  );
}
