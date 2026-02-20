import type { Node, Edge } from "@xyflow/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SkillEntry } from "@/lib/ipc";
import type { PublisherNodeData } from "./nodes/PublisherNode";
import type { SkillNodeData } from "./nodes/SkillNode";
import { groupSkillsByPublisher, PUBLISHER_META, type Publisher } from "./classifySkillPublisher";

type AnyNode = Node<PublisherNodeData, "publisher"> | Node<SkillNodeData, "skill">;
type LayoutGroup = { pubNode: AnyNode; skillNodes: AnyNode[] };

const NODE_W = 160;
const NODE_H = 36;
const GAP_X = 60;
const GAP_Y = 8;
const COL_GAP = 60;
const ROW_GAP = 48;

/**
 * Parallel layout — two groups per row:
 *   [Pub] → skills    skills ← [Pub]
 */
function parallelLayout(groups: LayoutGroup[]): void {
  const colW = NODE_W * 2 + GAP_X;
  let cursorY = 0;

  for (let i = 0; i < groups.length; i += 2) {
    const left = groups[i];
    const right = groups[i + 1];
    const leftH = left.skillNodes.length * (NODE_H + GAP_Y) - GAP_Y;
    const rightH = right ? right.skillNodes.length * (NODE_H + GAP_Y) - GAP_Y : 0;
    const rowH = Math.max(leftH, rightH, NODE_H);

    // left: publisher → skills
    left.pubNode.position = { x: 0, y: cursorY + rowH / 2 - NODE_H / 2 };
    left.skillNodes.forEach((n, j) => {
      n.position = { x: NODE_W + GAP_X, y: cursorY + j * (NODE_H + GAP_Y) };
    });

    // right: skills ← publisher
    if (right) {
      const rx = colW + COL_GAP;
      right.pubNode.position = { x: rx + NODE_W + GAP_X, y: cursorY + rowH / 2 - NODE_H / 2 };
      right.skillNodes.forEach((n, j) => {
        n.position = { x: rx, y: cursorY + j * (NODE_H + GAP_Y) };
      });
    }

    cursorY += rowH + ROW_GAP;
  }
}

export function useSkillsGraph(skills: SkillEntry[]) {
  const { t } = useTranslation("common");

  return useMemo(() => {
    const nodes: AnyNode[] = [];
    const edges: Edge[] = [];

    if (skills.length === 0) return { nodes, edges };

    const grouped = groupSkillsByPublisher(skills);
    const layoutGroups: LayoutGroup[] = [];

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

    parallelLayout(layoutGroups);
    return { nodes, edges };
  }, [skills, t]);
}
