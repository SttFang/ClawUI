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
import { useEffect, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { ipc } from "@/lib/ipc";

export function SecurityTab() {
  const { t } = useTranslation("common");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [allowElevatedWebchat, setAllowElevatedWebchat] = useState(false);
  const [allowElevatedDiscord, setAllowElevatedDiscord] = useState(false);
  const [sandboxMode, setSandboxMode] = useState<string>("off");
  const [workspaceAccess, setWorkspaceAccess] = useState<string>("rw");

  useEffect(() => {
    setLoading(true);
    ipc.security
      .get([
        "tools.elevated.allowFrom.webchat",
        "tools.elevated.allowFrom.discord",
        "agents.defaults.sandbox.mode",
        "agents.defaults.sandbox.workspaceAccess",
      ])
      .then((values) => {
        setAllowElevatedWebchat(values["tools.elevated.allowFrom.webchat"] === true);
        setAllowElevatedDiscord(values["tools.elevated.allowFrom.discord"] === true);
        const sm = values["agents.defaults.sandbox.mode"];
        if (typeof sm === "string") setSandboxMode(sm);
        const wa = values["agents.defaults.sandbox.workspaceAccess"];
        if (typeof wa === "string") setWorkspaceAccess(wa);
      })
      .catch((e) =>
        setMessage(
          e instanceof Error ? e.message : t("settings.page.security.messages.loadFailed"),
        ),
      )
      .finally(() => setLoading(false));
  }, [t]);

  const handleApply = () => {
    setLoading(true);
    setMessage(null);
    ipc.security
      .apply([
        { path: "tools.elevated.allowFrom.webchat", value: allowElevatedWebchat },
        { path: "tools.elevated.allowFrom.discord", value: allowElevatedDiscord },
        { path: "agents.defaults.sandbox.mode", value: sandboxMode },
        { path: "agents.defaults.sandbox.workspaceAccess", value: workspaceAccess },
      ])
      .then(() => setMessage(t("settings.page.security.messages.updated")))
      .catch((e) =>
        setMessage(
          e instanceof Error ? e.message : t("settings.page.security.messages.applyFailed"),
        ),
      )
      .finally(() => setLoading(false));
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
            checked={allowElevatedWebchat}
            onCheckedChange={setAllowElevatedWebchat}
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
            checked={allowElevatedDiscord}
            onCheckedChange={setAllowElevatedDiscord}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("settings.page.security.sandboxMode")}</Label>
          <Select
            value={sandboxMode}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setSandboxMode(e.target.value)}
            disabled={loading}
          >
            <option value="off">{t("settings.page.security.sandboxModeOptions.off")}</option>
            <option value="docker">{t("settings.page.security.sandboxModeOptions.docker")}</option>
            <option value="native">{t("settings.page.security.sandboxModeOptions.native")}</option>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t("settings.page.security.workspaceAccess")}</Label>
          <Select
            value={workspaceAccess}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setWorkspaceAccess(e.target.value)}
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
