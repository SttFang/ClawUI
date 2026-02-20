import type { SkillEntry } from "@/lib/ipc";

export type Publisher = "bundled" | "vercel" | "supabase" | "community" | "workspace" | "other";

export const PUBLISHER_META: Record<Publisher, { color: string; labelKey: string }> = {
  bundled: { color: "#6366f1", labelKey: "agents.skills.publishers.bundled" },
  vercel: { color: "#ef4444", labelKey: "agents.skills.publishers.vercel" },
  supabase: { color: "#22c55e", labelKey: "agents.skills.publishers.supabase" },
  community: { color: "#f59e0b", labelKey: "agents.skills.publishers.community" },
  workspace: { color: "#8b5cf6", labelKey: "agents.skills.publishers.workspace" },
  other: { color: "#64748b", labelKey: "agents.skills.publishers.other" },
};

const VERCEL_PREFIXES = ["vercel-", "web-design-"];
const SUPABASE_PREFIXES = ["supabase-", "postgres-"];
const COMMUNITY_NAMES = new Set(["agent-browser"]);
const COMMUNITY_PREFIXES = [
  "playwright-",
  "tailwind-",
  "ui-ux-",
  "aws-cdk-",
  "better-auth-",
  "web-artifacts-",
];

function classifyByName(name: string): Publisher {
  const n = name.toLowerCase();
  if (VERCEL_PREFIXES.some((p) => n.startsWith(p))) return "vercel";
  if (SUPABASE_PREFIXES.some((p) => n.startsWith(p))) return "supabase";
  if (COMMUNITY_NAMES.has(n) || COMMUNITY_PREFIXES.some((p) => n.startsWith(p))) return "community";
  return "other";
}

export function classifySkillPublisher(entry: SkillEntry): Publisher {
  if (entry.source === "openclaw-bundled") return "bundled";
  if (entry.source === "openclaw-workspace") return "workspace";
  return classifyByName(entry.name);
}

export function groupSkillsByPublisher(
  skills: SkillEntry[],
): Partial<Record<Publisher, SkillEntry[]>> {
  const groups: Partial<Record<Publisher, SkillEntry[]>> = {};
  for (const s of skills) {
    const pub = classifySkillPublisher(s);
    (groups[pub] ??= []).push(s);
  }
  return groups;
}
