import { Button, Input } from "@clawui/ui";
import { Loader2, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SkillStatusEntry } from "./skills/useSkillsManager";
import { SkillCard } from "./skills/SkillCard";
import { useSkillsManager } from "./skills/useSkillsManager";

type SkillGroup = {
  id: string;
  labelKey: string;
  skills: SkillStatusEntry[];
  collapsedByDefault: boolean;
};

const SKILL_SOURCE_GROUPS: Array<{
  id: string;
  labelKey: string;
  sources: string[];
  collapsedByDefault: boolean;
}> = [
  {
    id: "workspace",
    labelKey: "skillsPanel.groups.workspace",
    sources: ["openclaw-workspace"],
    collapsedByDefault: true,
  },
  {
    id: "built-in",
    labelKey: "skillsPanel.groups.builtIn",
    sources: ["openclaw-bundled"],
    collapsedByDefault: true,
  },
  {
    id: "installed",
    labelKey: "skillsPanel.groups.installed",
    sources: ["openclaw-managed"],
    collapsedByDefault: false,
  },
  {
    id: "extra",
    labelKey: "skillsPanel.groups.extra",
    sources: ["openclaw-extra"],
    collapsedByDefault: false,
  },
];

function groupSkills(skills: SkillStatusEntry[]): SkillGroup[] {
  const groups = new Map<string, SkillGroup>();
  for (const def of SKILL_SOURCE_GROUPS) {
    groups.set(def.id, {
      id: def.id,
      labelKey: def.labelKey,
      collapsedByDefault: def.collapsedByDefault,
      skills: [],
    });
  }

  const other: SkillGroup = {
    id: "other",
    labelKey: "skillsPanel.groups.other",
    collapsedByDefault: false,
    skills: [],
  };

  for (const skill of skills) {
    const byBundled = skill.bundled
      ? SKILL_SOURCE_GROUPS.find((group) => group.id === "built-in")
      : null;
    const bySource = SKILL_SOURCE_GROUPS.find((group) => group.sources.includes(skill.source));
    const target = byBundled ?? bySource;
    if (target) {
      groups.get(target.id)?.skills.push(skill);
    } else {
      other.skills.push(skill);
    }
  }

  const ordered = SKILL_SOURCE_GROUPS.map((group) => groups.get(group.id)).filter(
    (group): group is SkillGroup => Boolean(group && group.skills.length > 0),
  );
  if (other.skills.length > 0) ordered.push(other);
  return ordered;
}

export function SkillsSection() {
  const { t } = useTranslation("common");
  const [filter, setFilter] = useState("");
  const {
    loading,
    error,
    report,
    edits,
    setEdits,
    busyKey,
    messages,
    loadSkillsStatus,
    handleToggle,
    handleSaveApiKey,
    handleInstall,
  } = useSkillsManager();

  const filteredSkills = useMemo(() => {
    const list = report?.skills ?? [];
    const query = filter.trim().toLowerCase();
    if (!query) return list;
    return list.filter((skill) =>
      [skill.name, skill.description, skill.source].join(" ").toLowerCase().includes(query),
    );
  }, [filter, report]);

  const groups = useMemo(() => groupSkills(filteredSkills), [filteredSkills]);

  return (
    <>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h2 className="text-xl font-semibold">{t("agents.sections.skills.title")}</h2>
          <p className="text-muted-foreground">{t("skillsPanel.description")}</p>
        </div>
        <Button variant="outline" onClick={() => void loadSkillsStatus(true)} disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          {loading ? t("skillsPanel.loading") : t("skillsPanel.refresh")}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={t("skillsPanel.filterPlaceholder")}
          className="flex-1"
        />
        <div className="text-sm text-muted-foreground self-center">
          {t("skillsPanel.shown", { count: filteredSkills.length })}
        </div>
      </div>

      {error ? (
        <div className="mb-4 p-3 rounded-lg border border-destructive bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      ) : null}

      {filteredSkills.length === 0 ? (
        <div className="text-sm text-muted-foreground">{t("skillsPanel.empty")}</div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <details
              key={group.id}
              open={!group.collapsedByDefault}
              className="rounded-lg border bg-card"
            >
              <summary className="cursor-pointer px-4 py-3 flex items-center justify-between">
                <span className="font-medium">{t(group.labelKey)}</span>
                <span className="text-xs text-muted-foreground">{group.skills.length}</span>
              </summary>

              <div className="grid gap-3 p-4 md:grid-cols-2">
                {group.skills.map((skill) => (
                  <SkillCard
                    key={skill.skillKey}
                    skill={skill}
                    busy={busyKey === skill.skillKey}
                    message={messages[skill.skillKey]}
                    editValue={edits[skill.skillKey] ?? ""}
                    onEditChange={(value) =>
                      setEdits((prev) => ({ ...prev, [skill.skillKey]: value }))
                    }
                    onToggle={() => void handleToggle(skill)}
                    onInstall={() => void handleInstall(skill)}
                    onSaveApiKey={() => void handleSaveApiKey(skill.skillKey)}
                  />
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
