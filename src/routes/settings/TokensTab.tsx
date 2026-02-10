import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
} from "@clawui/ui";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useSecretsStore,
  selectSecretsLoading,
  selectSecretsSaving,
  selectSecretsError,
  selectSecretsSaveSuccess,
} from "@/store/secrets";

export function TokensTab() {
  const { t } = useTranslation("common");

  const secretsLoading = useSecretsStore(selectSecretsLoading);
  const secretsSaving = useSecretsStore(selectSecretsSaving);
  const secretsError = useSecretsStore(selectSecretsError);
  const secretsSaveSuccess = useSecretsStore(selectSecretsSaveSuccess);
  const discordBotToken = useSecretsStore((s) => s.discordBotToken);
  const discordAppToken = useSecretsStore((s) => s.discordAppToken);
  const telegramBotToken = useSecretsStore((s) => s.telegramBotToken);
  const slackBotToken = useSecretsStore((s) => s.slackBotToken);
  const slackAppToken = useSecretsStore((s) => s.slackAppToken);
  const setSecretValue = useSecretsStore((s) => s.setValue);
  const saveSecrets = useSecretsStore((s) => s.save);

  const fields = [
    { id: "discord-bot-token", key: "discordBotToken" as const, value: discordBotToken },
    { id: "discord-app-token", key: "discordAppToken" as const, value: discordAppToken },
    { id: "telegram-bot-token", key: "telegramBotToken" as const, value: telegramBotToken },
    { id: "slack-bot-token", key: "slackBotToken" as const, value: slackBotToken },
    { id: "slack-app-token", key: "slackAppToken" as const, value: slackAppToken },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.page.tokens.title")}</CardTitle>
        <CardDescription>{t("settings.page.tokens.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {secretsError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {secretsError}
          </div>
        ) : null}

        {fields.map((f) => (
          <div key={f.id} className="space-y-2">
            <Label htmlFor={f.id}>{t(`settings.page.tokens.fields.${f.key}`)}</Label>
            <Input
              id={f.id}
              type="password"
              value={f.value}
              onChange={(e) => setSecretValue(f.key, e.target.value)}
              placeholder="..."
              disabled={secretsLoading}
            />
          </div>
        ))}

        <div className="flex items-center gap-2">
          <Button onClick={saveSecrets} disabled={secretsSaving || secretsLoading}>
            {secretsSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("actions.save")}
          </Button>
          {secretsSaveSuccess ? (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              {t("settings.page.tokens.saved")}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
