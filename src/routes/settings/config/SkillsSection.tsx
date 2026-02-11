import { Button, Card, CardContent, Input } from "@clawui/ui";
import { Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ipc } from "@/lib/ipc";

type SkillInstallOption = {
  id: string;
  label: string;
};

type SkillStatusEntry = {
  name: string;
  description: string;
  source: string;
  skillKey: string;
  bundled?: boolean;
  primaryEnv?: string;
  emoji?: string;
  disabled: boolean;
  blockedByAllowlist: boolean;
  eligible: boolean;
  missing: {
    bins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  install: SkillInstallOption[];
};

type SkillStatusReport = {
  skills: SkillStatusEntry[];
};

type SkillMessageMap = Record<string, { kind: "success" | "error"; text: string }>;

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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function buildMissingSummary(skill: SkillStatusEntry): string[] {
  return [
    ...skill.missing.bins.map((item) => `bin:${item}`),
    ...skill.missing.env.map((item) => `env:${item}`),
    ...skill.missing.config.map((item) => `config:${item}`),
    ...skill.missing.os.map((item) => `os:${item}`),
  ];
}

export function SkillsSection() {
  const { t } = useTranslation("common");
  const loadingRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<SkillStatusReport | null>(null);
  const [filter, setFilter] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<SkillMessageMap>({});

  const setSkillMessage = (
    skillKey: string,
    message?: { kind: "success" | "error"; text: string },
  ) => {
    setMessages((prev) => {
      const next = { ...prev };
      if (message) {
        next[skillKey] = message;
      } else {
        delete next[skillKey];
      }
      return next;
    });
  };

  const loadSkillsStatus = useCallback(async (clearMessages = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    if (clearMessages) {
      setMessages({});
    }

    setLoading(true);
    setError(null);
    try {
      const payload = (await ipc.chat.request("skills.status", {})) as SkillStatusReport;
      setReport(payload);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSkillsStatus(true);
  }, [loadSkillsStatus]);

  const filteredSkills = useMemo(() => {
    const list = report?.skills ?? [];
    const query = filter.trim().toLowerCase();
    if (!query) return list;
    return list.filter((skill) =>
      [skill.name, skill.description, skill.source].join(" ").toLowerCase().includes(query),
    );
  }, [filter, report]);

  const groups = useMemo(() => groupSkills(filteredSkills), [filteredSkills]);

  const handleToggle = async (skill: SkillStatusEntry) => {
    setBusyKey(skill.skillKey);
    setError(null);
    try {
      const enabled = skill.disabled;
      await ipc.chat.request("skills.update", { skillKey: skill.skillKey, enabled });
      await loadSkillsStatus();
      setSkillMessage(skill.skillKey, {
        kind: "success",
        text: enabled ? t("skillsPanel.messages.enabled") : t("skillsPanel.messages.disabled"),
      });
    } catch (toggleError) {
      const message = getErrorMessage(toggleError);
      setError(message);
      setSkillMessage(skill.skillKey, { kind: "error", text: message });
    } finally {
      setBusyKey(null);
    }
  };

  const handleSaveApiKey = async (skillKey: string) => {
    setBusyKey(skillKey);
    setError(null);
    try {
      const apiKey = edits[skillKey] ?? "";
      await ipc.chat.request("skills.update", { skillKey, apiKey });
      await loadSkillsStatus();
      setSkillMessage(skillKey, {
        kind: "success",
        text: t("skillsPanel.messages.apiKeySaved"),
      });
    } catch (saveError) {
      const message = getErrorMessage(saveError);
      setError(message);
      setSkillMessage(skillKey, { kind: "error", text: message });
    } finally {
      setBusyKey(null);
    }
  };

  const handleInstall = async (skill: SkillStatusEntry) => {
    const option = skill.install[0];
    if (!option) return;

    setBusyKey(skill.skillKey);
    setError(null);
    try {
      const result = (await ipc.chat.request("skills.install", {
        name: skill.name,
        installId: option.id,
        timeoutMs: 120000,
      })) as { message?: string };
      await loadSkillsStatus();
      setSkillMessage(skill.skillKey, {
        kind: "success",
        text: result?.message ?? t("skillsPanel.actions.installed"),
      });
    } catch (installError) {
      const message = getErrorMessage(installError);
      setError(message);
      setSkillMessage(skill.skillKey, { kind: "error", text: message });
    } finally {
      setBusyKey(null);
    }
  };

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
                {group.skills.map((skill) => {
                  const busy = busyKey === skill.skillKey;
                  const message = messages[skill.skillKey];
                  const missing = buildMissingSummary(skill);
                  const reasons = [
                    ...(skill.disabled ? [t("skillsPanel.reasons.disabled")] : []),
                    ...(skill.blockedByAllowlist
                      ? [t("skillsPanel.reasons.blockedByAllowlist")]
                      : []),
                  ];

                  return (
                    <Card key={skill.skillKey}>
                      <CardContent className="p-4 space-y-3">
                        <div>
                          <div className="font-medium text-sm">
                            {skill.emoji ? `${skill.emoji} ` : ""}
                            {skill.name}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {skill.description}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded border">{skill.source}</span>
                          {skill.bundled ? (
                            <span className="px-2 py-0.5 rounded border">
                              {t("skillsPanel.badges.bundled")}
                            </span>
                          ) : null}
                          <span className="px-2 py-0.5 rounded border">
                            {skill.eligible
                              ? t("skillsPanel.badges.eligible")
                              : t("skillsPanel.badges.blocked")}
                          </span>
                          {skill.disabled ? (
                            <span className="px-2 py-0.5 rounded border">
                              {t("skillsPanel.badges.disabled")}
                            </span>
                          ) : null}
                        </div>

                        {missing.length > 0 ? (
                          <div className="text-xs text-muted-foreground">
                            {t("skillsPanel.labels.missing")}: {missing.join(", ")}
                          </div>
                        ) : null}

                        {reasons.length > 0 ? (
                          <div className="text-xs text-muted-foreground">
                            {t("skillsPanel.labels.reason")}: {reasons.join(", ")}
                          </div>
                        ) : null}

                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void handleToggle(skill)}
                          >
                            {skill.disabled
                              ? t("skillsPanel.actions.enable")
                              : t("skillsPanel.actions.disable")}
                          </Button>
                          {skill.install.length > 0 && skill.missing.bins.length > 0 ? (
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() => void handleInstall(skill)}
                            >
                              {busy ? t("skillsPanel.actions.installing") : skill.install[0].label}
                            </Button>
                          ) : null}
                        </div>

                        {skill.primaryEnv ? (
                          <div className="space-y-2">
                            <div className="text-xs text-muted-foreground">
                              {t("skillsPanel.labels.apiKey")}
                            </div>
                            <Input
                              type="password"
                              value={edits[skill.skillKey] ?? ""}
                              onChange={(event) =>
                                setEdits((prev) => ({
                                  ...prev,
                                  [skill.skillKey]: event.target.value,
                                }))
                              }
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => void handleSaveApiKey(skill.skillKey)}
                            >
                              {t("skillsPanel.actions.saveKey")}
                            </Button>
                          </div>
                        ) : null}

                        {message ? (
                          <div
                            className={`text-xs ${message.kind === "error" ? "text-destructive" : "text-green-600"}`}
                          >
                            {message.text}
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
