export type Publisher = "vercel" | "supabase" | "community" | "other";

export const PUBLISHER_META: Record<Publisher, { color: string; labelKey: string }> = {
  vercel: { color: "#0070f3", labelKey: "agents.skills.publishers.vercel" },
  supabase: { color: "#3ecf8e", labelKey: "agents.skills.publishers.supabase" },
  community: { color: "#a855f7", labelKey: "agents.skills.publishers.community" },
  other: { color: "#6b7280", labelKey: "agents.skills.publishers.other" },
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

export function classifySkillPublisher(name: string): Publisher {
  const n = name.toLowerCase();
  if (VERCEL_PREFIXES.some((p) => n.startsWith(p))) return "vercel";
  if (SUPABASE_PREFIXES.some((p) => n.startsWith(p))) return "supabase";
  if (COMMUNITY_NAMES.has(n) || COMMUNITY_PREFIXES.some((p) => n.startsWith(p))) return "community";
  return "other";
}

export function groupSkillsByPublisher(skills: string[]): Partial<Record<Publisher, string[]>> {
  const groups: Partial<Record<Publisher, string[]>> = {};
  for (const s of skills) {
    const pub = classifySkillPublisher(s);
    (groups[pub] ??= []).push(s);
  }
  return groups;
}
