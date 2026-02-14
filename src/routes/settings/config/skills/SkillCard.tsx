import { Button, Card, CardContent, Input } from "@clawui/ui";
import { useTranslation } from "react-i18next";
import type { SkillStatusEntry } from "./useSkillsManager";

function buildMissingSummary(skill: SkillStatusEntry): string[] {
  return [
    ...skill.missing.bins.map((item) => `bin:${item}`),
    ...skill.missing.env.map((item) => `env:${item}`),
    ...skill.missing.config.map((item) => `config:${item}`),
    ...skill.missing.os.map((item) => `os:${item}`),
  ];
}

type SkillCardProps = {
  skill: SkillStatusEntry;
  busy: boolean;
  message?: { kind: "success" | "error"; text: string };
  editValue: string;
  onEditChange: (value: string) => void;
  onToggle: () => void;
  onInstall: () => void;
  onSaveApiKey: () => void;
};

export function SkillCard({
  skill,
  busy,
  message,
  editValue,
  onEditChange,
  onToggle,
  onInstall,
  onSaveApiKey,
}: SkillCardProps) {
  const { t } = useTranslation("common");
  const missing = buildMissingSummary(skill);
  const reasons = [
    ...(skill.disabled ? [t("skillsPanel.reasons.disabled")] : []),
    ...(skill.blockedByAllowlist ? [t("skillsPanel.reasons.blockedByAllowlist")] : []),
  ];

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div>
          <div className="font-medium text-sm">
            {skill.emoji ? `${skill.emoji} ` : ""}
            {skill.name}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{skill.description}</div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-0.5 rounded border">{skill.source}</span>
          {skill.bundled ? (
            <span className="px-2 py-0.5 rounded border">{t("skillsPanel.badges.bundled")}</span>
          ) : null}
          <span className="px-2 py-0.5 rounded border">
            {skill.eligible ? t("skillsPanel.badges.eligible") : t("skillsPanel.badges.blocked")}
          </span>
          {skill.disabled ? (
            <span className="px-2 py-0.5 rounded border">{t("skillsPanel.badges.disabled")}</span>
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
          <Button size="sm" variant="outline" disabled={busy} onClick={onToggle}>
            {skill.disabled ? t("skillsPanel.actions.enable") : t("skillsPanel.actions.disable")}
          </Button>
          {skill.install.length > 0 && skill.missing.bins.length > 0 ? (
            <Button size="sm" disabled={busy} onClick={onInstall}>
              {busy ? t("skillsPanel.actions.installing") : skill.install[0].label}
            </Button>
          ) : null}
        </div>

        {skill.primaryEnv ? (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">{t("skillsPanel.labels.apiKey")}</div>
            <Input
              type="password"
              value={editValue}
              onChange={(event) => onEditChange(event.target.value)}
            />
            <Button size="sm" variant="outline" disabled={busy} onClick={onSaveApiKey}>
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
}
