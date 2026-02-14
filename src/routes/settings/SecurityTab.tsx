import type { ChangeEvent } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Label,
  Select,
  Switch,
} from "@clawui/ui";
import { useTranslation } from "react-i18next";
import { useConfigManager } from "@/hooks/useConfigManager";
import { configCoreManager } from "@/store/configDraft/manager";

const SECURITY_PATHS = {
  allowElevatedWebchat: {
    path: ["tools", "elevated", "allowFrom", "webchat"],
    default: false as const,
  },
  allowElevatedDiscord: {
    path: ["tools", "elevated", "allowFrom", "discord"],
    default: false as const,
  },
  sandboxMode: {
    path: ["agents", "defaults", "sandbox", "mode"],
    default: "off" as const,
  },
  workspaceAccess: {
    path: ["agents", "defaults", "sandbox", "workspaceAccess"],
    default: "rw" as const,
  },
};

export function SecurityTab() {
  const { t } = useTranslation("common");

  const { fields, setField, loading, message, setMessage, apply } = useConfigManager({
    manager: configCoreManager,
    paths: SECURITY_PATHS,
    messages: { loadFailed: t("settings.page.security.messages.loadFailed") },
  });

  const handleApply = () => {
    apply({
      onSuccess: () => setMessage(t("settings.page.security.messages.updated")),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.page.security.title")}</CardTitle>
        <CardDescription>{t("settings.page.security.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {message}
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <div>
            <Label>{t("settings.page.security.allowElevatedWebchat")}</Label>
            <p className="text-sm text-muted-foreground">
              {t("settings.page.security.allowElevatedWebchatHint")}
            </p>
          </div>
          <Switch
            checked={fields.allowElevatedWebchat as boolean}
            onCheckedChange={(v) => setField("allowElevatedWebchat", v)}
            disabled={loading}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>{t("settings.page.security.allowElevatedDiscord")}</Label>
            <p className="text-sm text-muted-foreground">
              {t("settings.page.security.allowElevatedDiscordHint")}
            </p>
          </div>
          <Switch
            checked={fields.allowElevatedDiscord as boolean}
            onCheckedChange={(v) => setField("allowElevatedDiscord", v)}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("settings.page.security.sandboxMode")}</Label>
          <Select
            value={fields.sandboxMode as string}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              setField("sandboxMode", e.target.value)
            }
            disabled={loading}
          >
            <option value="off">{t("settings.page.security.sandboxModeOptions.off")}</option>
            <option value="non-main">
              {t("settings.page.security.sandboxModeOptions.nonMain")}
            </option>
            <option value="all">{t("settings.page.security.sandboxModeOptions.all")}</option>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t("settings.page.security.workspaceAccess")}</Label>
          <Select
            value={fields.workspaceAccess as string}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              setField("workspaceAccess", e.target.value)
            }
            disabled={loading}
          >
            <option value="none">{t("settings.page.security.workspaceAccessOptions.none")}</option>
            <option value="ro">{t("settings.page.security.workspaceAccessOptions.ro")}</option>
            <option value="rw">{t("settings.page.security.workspaceAccessOptions.rw")}</option>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button disabled={loading} onClick={handleApply}>
            {t("settings.page.security.actions.apply")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
