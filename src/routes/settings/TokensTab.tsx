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

// Channel definitions — matches CHANNEL_TOKEN_DEFS in credential-service
const CHANNEL_DEFS = [
  {
    channelType: "discord",
    label: "Discord",
    fields: [{ field: "token", label: "Bot Token" }],
  },
  {
    channelType: "telegram",
    label: "Telegram",
    fields: [{ field: "botToken", label: "Bot Token" }],
  },
  {
    channelType: "slack",
    label: "Slack",
    fields: [
      { field: "botToken", label: "Bot Token" },
      { field: "appToken", label: "App Token" },
      { field: "userToken", label: "User Token" },
      { field: "signingSecret", label: "Signing Secret" },
    ],
  },
  {
    channelType: "signal",
    label: "Signal",
    fields: [{ field: "account", label: "Phone Number" }],
  },
  {
    channelType: "whatsapp",
    label: "WhatsApp",
    fields: [{ field: "authDir", label: "Auth Directory" }],
  },
  {
    channelType: "irc",
    label: "IRC",
    fields: [{ field: "password", label: "Server Password" }],
  },
  {
    channelType: "googlechat",
    label: "Google Chat",
    fields: [{ field: "serviceAccountFile", label: "Service Account File" }],
  },
] as const;

// Tool definitions — matches TOOL_CREDENTIAL_DEFS in tool-credential-registry
const TOOL_DEFS = [
  { toolId: "web_search_brave", label: "Brave Search", placeholder: "BSA..." },
  { toolId: "web_search_perplexity", label: "Perplexity", placeholder: "pplx-..." },
  { toolId: "web_search_grok", label: "Grok (xAI)", placeholder: "xai-..." },
  { toolId: "web_fetch_firecrawl", label: "Firecrawl", placeholder: "fc-..." },
] as const;

export function TokensTab() {
  const { t } = useTranslation("common");

  const isLoading = useSecretsStore(selectSecretsLoading);
  const isSaving = useSecretsStore(selectSecretsSaving);
  const error = useSecretsStore(selectSecretsError);
  const saveSuccess = useSecretsStore(selectSecretsSaveSuccess);
  const channelValues = useSecretsStore((s) => s.channelValues);
  const toolValues = useSecretsStore((s) => s.toolValues);
  const setChannelValue = useSecretsStore((s) => s.setChannelValue);
  const setToolValue = useSecretsStore((s) => s.setToolValue);
  const save = useSecretsStore((s) => s.save);

  return (
    <div className="space-y-6">
      {/* Channel Tokens */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.page.tokens.channelSection")}</CardTitle>
          <CardDescription>{t("settings.page.tokens.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {CHANNEL_DEFS.map((ch) => (
            <div key={ch.channelType} className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">{ch.label}</h4>
              {ch.fields.map((f) => {
                const key = `${ch.channelType}:${f.field}`;
                return (
                  <div key={key} className="space-y-1.5 pl-3">
                    <Label htmlFor={key}>{f.label}</Label>
                    <Input
                      id={key}
                      type="password"
                      value={channelValues[key] ?? ""}
                      onChange={(e) => setChannelValue(key, e.target.value)}
                      placeholder="..."
                      disabled={isLoading}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Tool API Keys */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.page.tokens.toolSection")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {TOOL_DEFS.map((tool) => (
            <div key={tool.toolId} className="space-y-1.5">
              <Label htmlFor={tool.toolId}>{tool.label}</Label>
              <Input
                id={tool.toolId}
                type="password"
                value={toolValues[tool.toolId] ?? ""}
                onChange={(e) => setToolValue(tool.toolId, e.target.value)}
                placeholder={tool.placeholder}
                disabled={isLoading}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={isSaving || isLoading}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("actions.save")}
        </Button>
        {saveSuccess ? (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            {t("settings.page.tokens.saved")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
