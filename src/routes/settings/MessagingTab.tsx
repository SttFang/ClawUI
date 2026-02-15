import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Input,
  Label,
  Switch,
} from "@clawui/ui";
import { CheckCircle2, ChevronDown, Loader2, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { ChannelConfig } from "@/lib/ipc";
import { TelegramConfigDialog, DiscordConfigDialog } from "@/features/Channels";
import { getChannelBrandIcon } from "@/lib/channelBrandIcons";
import { useChannelsStore, selectChannels, type ChannelType } from "@/store/channels";
import {
  useSecretsStore,
  selectSecretsLoading,
  selectSecretsSaving,
  selectSecretsError,
  selectSecretsSaveSuccess,
  selectHasUnsavedChanges,
} from "@/store/secrets";

// Channel definitions — matches CHANNEL_TOKEN_DEFS in credential-service
const CHANNEL_DEFS = [
  {
    channelType: "discord",
    label: "Discord",
    fields: [{ field: "token", label: "Bot Token" }],
    primary: true,
  },
  {
    channelType: "telegram",
    label: "Telegram",
    fields: [{ field: "botToken", label: "Bot Token" }],
    primary: true,
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
    primary: true,
  },
  {
    channelType: "signal",
    label: "Signal",
    fields: [{ field: "account", label: "Phone Number" }],
    primary: false,
  },
  {
    channelType: "whatsapp",
    label: "WhatsApp",
    fields: [{ field: "authDir", label: "Auth Directory" }],
    primary: false,
  },
  {
    channelType: "irc",
    label: "IRC",
    fields: [{ field: "password", label: "Server Password" }],
    primary: false,
  },
  {
    channelType: "googlechat",
    label: "Google Chat",
    fields: [{ field: "serviceAccountFile", label: "Service Account File" }],
    primary: false,
  },
] as const;

export function MessagingTab() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();

  // Channel state
  const channels = useChannelsStore(selectChannels);
  const channelsError = useChannelsStore((s) => s.error);
  const { loadChannels, enableChannel, disableChannel, configureChannel } = useChannelsStore();

  // Secrets state (channel tokens)
  const isLoading = useSecretsStore(selectSecretsLoading);
  const isSaving = useSecretsStore(selectSecretsSaving);
  const secretsError = useSecretsStore(selectSecretsError);
  const saveSuccess = useSecretsStore(selectSecretsSaveSuccess);
  const hasUnsaved = useSecretsStore(selectHasUnsavedChanges);
  const channelValues = useSecretsStore((s) => s.channelValues);

  const error = secretsError || channelsError;
  const setChannelValue = useSecretsStore((s) => s.setChannelValue);
  const save = useSecretsStore((s) => s.save);
  const load = useSecretsStore((s) => s.load);

  const [telegramDialogOpen, setTelegramDialogOpen] = useState(false);
  const [discordDialogOpen, setDiscordDialogOpen] = useState(false);

  useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

  const handleConfigure = (type: ChannelType) => {
    if (type === "telegram") setTelegramDialogOpen(true);
    else if (type === "discord") setDiscordDialogOpen(true);
  };

  const handleSaveConfig = async (type: ChannelType, config: ChannelConfig) => {
    await configureChannel(type, config);
  };

  const getChannelConfig = (type: ChannelType) => {
    return channels.find((c) => c.type === type)?.config ?? null;
  };

  const getChannelState = (channelType: string) => {
    return channels.find((c) => c.type === channelType);
  };

  const primaryDefs = CHANNEL_DEFS.filter((d) => d.primary);
  const secondaryDefs = CHANNEL_DEFS.filter((d) => !d.primary);

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <p className="text-muted-foreground">{t("settings.page.messaging.description")}</p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-center justify-between gap-2">
          <span>
            {error.includes("Credentials API") || error.includes("credentials")
              ? t("settings.page.messaging.credentialsError")
              : error}
          </span>
          {(error.includes("Credentials API") || error.includes("credentials")) && (
            <Button variant="ghost" size="sm" onClick={() => navigate("/settings?tab=general")}>
              {t("settings.page.messaging.checkGateway")}
            </Button>
          )}
        </div>
      ) : null}

      {/* Primary channels */}
      <div className="rounded-lg border divide-y">
        {primaryDefs.map((ch) => {
          const channelState = getChannelState(ch.channelType);
          const Icon = getChannelBrandIcon(ch.channelType as ChannelType);
          return (
            <ChannelCard
              key={ch.channelType}
              channelType={ch.channelType}
              label={ch.label}
              fields={ch.fields}
              icon={Icon ? <Icon size={22} /> : null}
              isEnabled={channelState?.isEnabled ?? false}
              isConfigured={channelState?.isConfigured ?? false}
              isEditable={channelState?.isEditable ?? false}
              channelValues={channelValues}
              setChannelValue={setChannelValue}
              isLoading={isLoading}
              onEnable={() => enableChannel(ch.channelType as ChannelType)}
              onDisable={() => disableChannel(ch.channelType as ChannelType)}
              onConfigure={() => handleConfigure(ch.channelType as ChannelType)}
              t={t}
            />
          );
        })}
      </div>

      {/* Secondary channels (collapsible) */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2">
            <ChevronDown className="h-4 w-4" />
            {t("settings.page.messaging.moreChannels")}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <div className="rounded-lg border divide-y">
            {secondaryDefs.map((ch) => {
              const channelState = getChannelState(ch.channelType);
              const Icon = getChannelBrandIcon(ch.channelType as ChannelType);
              return (
                <ChannelCard
                  key={ch.channelType}
                  channelType={ch.channelType}
                  label={ch.label}
                  fields={ch.fields}
                  icon={Icon ? <Icon size={22} /> : null}
                  isEnabled={channelState?.isEnabled ?? false}
                  isConfigured={channelState?.isConfigured ?? false}
                  isEditable={channelState?.isEditable ?? false}
                  channelValues={channelValues}
                  setChannelValue={setChannelValue}
                  isLoading={isLoading}
                  onEnable={() => enableChannel(ch.channelType as ChannelType)}
                  onDisable={() => disableChannel(ch.channelType as ChannelType)}
                  onConfigure={() => handleConfigure(ch.channelType as ChannelType)}
                  t={t}
                />
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Sticky unsaved-changes bar */}
      {hasUnsaved && (
        <div className="sticky bottom-0 z-10 -mx-6 px-6 py-3 bg-background/95 backdrop-blur border-t flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {t("settings.page.messaging.unsavedChanges")}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()}>
              {t("actions.discard")}
            </Button>
            <Button size="sm" onClick={save} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("actions.save")}
            </Button>
          </div>
        </div>
      )}
      {saveSuccess ? (
        <span className="flex items-center gap-1 text-sm text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          {t("settings.page.tokens.saved")}
        </span>
      ) : null}

      <TelegramConfigDialog
        open={telegramDialogOpen}
        onOpenChange={setTelegramDialogOpen}
        config={getChannelConfig("telegram")}
        onSave={(config) => handleSaveConfig("telegram", config)}
      />
      <DiscordConfigDialog
        open={discordDialogOpen}
        onOpenChange={setDiscordDialogOpen}
        config={getChannelConfig("discord")}
        onSave={(config) => handleSaveConfig("discord", config)}
      />
    </div>
  );
}

function ChannelCard({
  channelType,
  label,
  fields,
  icon,
  isEnabled,
  isConfigured,
  isEditable,
  channelValues,
  setChannelValue,
  isLoading,
  onEnable,
  onDisable,
  onConfigure,
  t,
}: {
  channelType: string;
  label: string;
  fields: ReadonlyArray<{ field: string; label: string }>;
  icon: React.ReactNode;
  isEnabled: boolean;
  isConfigured: boolean;
  isEditable: boolean;
  channelValues: Record<string, string>;
  setChannelValue: (key: string, value: string) => void;
  isLoading: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onConfigure: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {icon}
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">
            {isConfigured ? t("channels.status.configured") : t("channels.status.notConfigured")}
          </span>
        </div>
        <Switch
          checked={isEnabled}
          onCheckedChange={(checked) => (checked ? onEnable() : onDisable())}
          disabled={!isConfigured}
        />
      </div>
      <div className={fields.length >= 3 ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "space-y-3"}>
        {fields.map((f) => {
          const key = `${channelType}:${f.field}`;
          return (
            <div key={key} className="space-y-1.5">
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
        {isEditable && (channelType === "telegram" || channelType === "discord") && (
          <Button variant="outline" size="sm" onClick={onConfigure} className="col-span-full">
            <Settings className="w-4 h-4 mr-2" />
            {t("channels.actions.configure")}
          </Button>
        )}
      </div>
    </div>
  );
}
