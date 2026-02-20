import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type NodeTypes,
} from "@xyflow/react";
import { useCallback } from "react";
import "@xyflow/react/dist/style.css";
import "./skills-graph.css";
import type { SkillsProfileList } from "@/lib/ipc";
import { ProfileNode } from "./nodes/ProfileNode";
import { PublisherNode } from "./nodes/PublisherNode";
import { SkillNode } from "./nodes/SkillNode";
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
      nodeTypes={nodeTypes}
      fitView
      proOptions={{ hideAttribution: true }}
      nodesDraggable
      nodesConnectable={false}
      className="bg-background"
    >
      <Background gap={16} size={1} className="opacity-30" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
