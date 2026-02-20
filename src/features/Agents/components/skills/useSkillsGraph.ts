import type { Node, Edge } from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SkillsProfileList } from "@/lib/ipc";
import type { ProfileNodeData } from "./nodes/ProfileNode";
import type { PublisherNodeData } from "./nodes/PublisherNode";
import type { SkillNodeData } from "./nodes/SkillNode";
import { groupSkillsByPublisher, PUBLISHER_META, type Publisher } from "./classifySkillPublisher";

type AnyNode =
  | Node<ProfileNodeData, "profile">
  | Node<PublisherNodeData, "publisher">
  | Node<SkillNodeData, "skill">;

interface ProfileInput {
  id: string;
  label: string;
  data: SkillsProfileList | null;
}

const NODE_W = 160;
const NODE_H = 48;

function layoutGraph(nodes: AnyNode[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: 80, nodesep: 40 });
  for (const n of nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  return nodes.map((n) => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } };
  });
}

export function useSkillsGraph(profiles: ProfileInput[]) {
  const { t } = useTranslation("common");

  return useMemo(() => {
    const nodes: AnyNode[] = [];
    const edges: Edge[] = [];

    for (const profile of profiles) {
      const skills = profile.data?.skills ?? [];
      if (skills.length === 0) continue;

      const profileId = `profile-${profile.id}`;
      nodes.push({
        id: profileId,
        type: "profile",
        position: { x: 0, y: 0 },
        data: { label: profile.label, dir: profile.data?.dir ?? "" },
      });

      const groups = groupSkillsByPublisher(skills);
      for (const [pub, list] of Object.entries(groups) as [Publisher, string[]][]) {
        const meta = PUBLISHER_META[pub];
        const pubId = `${profileId}-pub-${pub}`;
        nodes.push({
          id: pubId,
          type: "publisher",
          position: { x: 0, y: 0 },
          data: { label: t(meta.labelKey), count: list.length, color: meta.color },
        });
        edges.push({
          id: `e-${profileId}-${pubId}`,
          source: profileId,
          target: pubId,
          animated: true,
          style: { stroke: meta.color, strokeWidth: 2 },
        });

        for (const skill of list) {
          const skillId = `${pubId}-skill-${skill}`;
          nodes.push({
            id: skillId,
            type: "skill",
            position: { x: 0, y: 0 },
            data: { label: skill, color: meta.color, publisher: t(meta.labelKey) },
          });
          edges.push({
            id: `e-${pubId}-${skillId}`,
            source: pubId,
            target: skillId,
            animated: true,
            style: { stroke: meta.color, strokeWidth: 1, opacity: 0.6 },
          });
        }
      }
    }

    const laid = layoutGraph(nodes, edges);
    return { nodes: laid, edges };
  }, [profiles, t]);
}
