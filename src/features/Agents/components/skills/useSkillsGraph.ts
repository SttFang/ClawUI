import type { Node, Edge } from "@xyflow/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SkillEntry } from "@/lib/ipc";
import type { PublisherNodeData } from "./nodes/PublisherNode";
import type { SkillNodeData } from "./nodes/SkillNode";
import { groupSkillsByPublisher, PUBLISHER_META, type Publisher } from "./classifySkillPublisher";

type AnyNode = Node<PublisherNodeData, "publisher"> | Node<SkillNodeData, "skill">;

const NODE_W = 160;
const NODE_H = 36;
const GAP_X = 80;
const GAP_Y = 8;
const GROUP_GAP_Y = 48;

/**
 * Zigzag layout: odd groups publisher-left → skills-right,
 * even groups skills-left ← publisher-right.
 */
function zigzagLayout(groups: { pubNode: AnyNode; skillNodes: AnyNode[] }[]): void {
  let cursorY = 0;
  const totalW = NODE_W * 2 + GAP_X;

  for (let i = 0; i < groups.length; i++) {
    const { pubNode, skillNodes } = groups[i];
    const groupH = skillNodes.length * (NODE_H + GAP_Y) - GAP_Y;
    const pubY = cursorY + Math.max(0, groupH / 2 - NODE_H / 2);
    const leftToRight = i % 2 === 0;

    if (leftToRight) {
      pubNode.position = { x: 0, y: pubY };
      skillNodes.forEach((n, j) => {
        n.position = { x: NODE_W + GAP_X, y: cursorY + j * (NODE_H + GAP_Y) };
      });
    } else {
      pubNode.position = { x: totalW - NODE_W, y: pubY };
      skillNodes.forEach((n, j) => {
        n.position = { x: 0, y: cursorY + j * (NODE_H + GAP_Y) };
      });
    }

    cursorY += Math.max(groupH, NODE_H) + GROUP_GAP_Y;
  }
}

export function useSkillsGraph(skills: SkillEntry[]) {
  const { t } = useTranslation("common");

  return useMemo(() => {
    const nodes: AnyNode[] = [];
    const edges: Edge[] = [];

    if (skills.length === 0) return { nodes, edges };

    const grouped = groupSkillsByPublisher(skills);
    const layoutGroups: { pubNode: AnyNode; skillNodes: AnyNode[] }[] = [];

    for (const [pub, list] of Object.entries(grouped) as [Publisher, SkillEntry[]][]) {
      const meta = PUBLISHER_META[pub];
      const pubId = `pub-${pub}`;
      const pubNode: AnyNode = {
        id: pubId,
        type: "publisher",
        position: { x: 0, y: 0 },
        data: { label: t(meta.labelKey), count: list.length, color: meta.color },
      };
      nodes.push(pubNode);

      const skillNodes: AnyNode[] = [];
      for (const entry of list) {
        const skillId = `${pubId}-skill-${entry.name}`;
        const sn: AnyNode = {
          id: skillId,
          type: "skill",
          position: { x: 0, y: 0 },
          data: {
            label: entry.name,
            color: meta.color,
            publisher: t(meta.labelKey),
            description: entry.description,
          },
        };
        nodes.push(sn);
        skillNodes.push(sn);
        edges.push({
          id: `e-${pubId}-${skillId}`,
          source: pubId,
          target: skillId,
          animated: true,
          style: { stroke: meta.color, strokeWidth: 1, opacity: 0.6 },
        });
      }
      layoutGroups.push({ pubNode, skillNodes });
    }

    zigzagLayout(layoutGroups);
    return { nodes, edges };
  }, [skills, t]);
}
