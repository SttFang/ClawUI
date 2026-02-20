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
import { useCallback, useState } from "react";
import "@xyflow/react/dist/style.css";
import "./skills-graph.css";
import type { SkillsProfileList } from "@/lib/ipc";
import { ProfileNode } from "./nodes/ProfileNode";
import { PublisherNode } from "./nodes/PublisherNode";
import { SkillNode, type SkillNodeData } from "./nodes/SkillNode";
import { useSkillsGraph } from "./useSkillsGraph";

const nodeTypes: NodeTypes = {
  profile: ProfileNode,
  publisher: PublisherNode,
  skill: SkillNode,
};

interface Props {
  mainSkills: SkillsProfileList | null;
  configAgentSkills: SkillsProfileList | null;
}

export function SkillsNetworkGraph({ mainSkills, configAgentSkills }: Props) {
  const { nodes: initialNodes, edges: initialEdges } = useSkillsGraph([
    { id: "main", label: "main", data: mainSkills },
    { id: "configAgent", label: "configAgent", data: configAgentSkills },
  ]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const [selected, setSelected] = useState<SkillNodeData | null>(null);

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
          </div>
        </Panel>
      )}
    </ReactFlow>
  );
}
