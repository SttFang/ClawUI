import type { Node, Edge } from "@xyflow/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SkillEntry } from "@/lib/ipc";
import type { PublisherNodeData } from "./nodes/PublisherNode";
import type { SkillNodeData } from "./nodes/SkillNode";
import { groupSkillsByPublisher, PUBLISHER_META, type Publisher } from "./classifySkillPublisher";

type AnyNode = Node<PublisherNodeData, "publisher"> | Node<SkillNodeData, "skill">;
type LayoutGroup = { pubNode: AnyNode; skillNodes: AnyNode[] };

const NODE_W = 150;
const NODE_H = 34;
const GAP_X = 40;
const GAP_Y = 6;
const PAIR_GAP = 36;
const ROW_GAP = 40;

/**
 * 4-column parallel layout per row:
 *   skills←[Pub] [Pub]→skills | skills←[Pub] [Pub]→skills
 */
function parallelLayout(groups: LayoutGroup[]): void {
  const pairW = (NODE_W + GAP_X) * 2;
  let cursorY = 0;

  for (let i = 0; i < groups.length; i += 4) {
    const row = groups.slice(i, i + 4);
    const heights = row.map((g) =>
      Math.max(g.skillNodes.length * (NODE_H + GAP_Y) - GAP_Y, NODE_H),
    );
    const rowH = Math.max(...heights);

    for (let p = 0; p < row.length; p += 2) {
      const pairX = (p / 2) * (pairW + PAIR_GAP);
      const a = row[p];
      const b = row[p + 1];

      // left of pair: skills ← [Pub]
      a.pubNode.position = { x: pairX + NODE_W + GAP_X, y: cursorY + rowH / 2 - NODE_H / 2 };
      a.skillNodes.forEach((n, j) => {
        n.position = { x: pairX, y: cursorY + j * (NODE_H + GAP_Y) };
      });

      // right of pair: [Pub] → skills
      if (b) {
        const bx = pairX + (NODE_W + GAP_X) + NODE_W + GAP_X;
        b.pubNode.position = { x: bx - NODE_W - GAP_X, y: cursorY + rowH / 2 - NODE_H / 2 };
        b.skillNodes.forEach((n, j) => {
          n.position = { x: bx, y: cursorY + j * (NODE_H + GAP_Y) };
        });
      }
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
