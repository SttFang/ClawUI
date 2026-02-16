export const ENV_ANTHROPIC_API_KEY = "ANTHROPIC_API_KEY";
export const ENV_OPENAI_API_KEY = "OPENAI_API_KEY";
export const ENV_PROXY_URL = "OPENCLAW_PROXY_URL";
export const ENV_PROXY_TOKEN = "OPENCLAW_PROXY_TOKEN";

// --- Channel Token Definitions ---

export interface ChannelTokenFieldDef {
  field: string;
  configPath: string;
  label: string;
}

export interface ChannelTokenDef {
  channelType: string;
  label: string;
  fields: ChannelTokenFieldDef[];
}

export const CHANNEL_TOKEN_DEFS: ChannelTokenDef[] = [
  {
    channelType: "discord",
    label: "Discord",
    fields: [{ field: "token", configPath: "channels.discord.token", label: "Bot Token" }],
  },
  {
    channelType: "telegram",
    label: "Telegram",
    fields: [{ field: "botToken", configPath: "channels.telegram.botToken", label: "Bot Token" }],
  },
  {
    channelType: "slack",
    label: "Slack",
    fields: [
      { field: "botToken", configPath: "channels.slack.botToken", label: "Bot Token" },
      { field: "appToken", configPath: "channels.slack.appToken", label: "App Token" },
      { field: "userToken", configPath: "channels.slack.userToken", label: "User Token" },
      {
        field: "signingSecret",
        configPath: "channels.slack.signingSecret",
        label: "Signing Secret",
      },
    ],
  },
  {
    channelType: "whatsapp",
    label: "WhatsApp",
    fields: [
      { field: "authDir", configPath: "channels.whatsapp.authDir", label: "Auth Directory" },
    ],
  },
  {
    channelType: "irc",
    label: "IRC",
    fields: [{ field: "password", configPath: "channels.irc.password", label: "Server Password" }],
  },
  {
    channelType: "signal",
    label: "Signal",
    fields: [{ field: "account", configPath: "channels.signal.account", label: "Phone Number" }],
  },
  {
    channelType: "googlechat",
    label: "Google Chat",
    fields: [
      {
        field: "serviceAccountFile",
        configPath: "channels.googlechat.serviceAccountFile",
        label: "Service Account File",
      },
    ],
  },
];

/** Legacy env->configPath map for channel token migration. */
export const LEGACY_CHANNEL_ENV_MAP: Array<{
  envKey: string;
  channelType: string;
  field: string;
  configPath: string;
}> = [
  {
    envKey: "DISCORD_BOT_TOKEN",
    channelType: "discord",
    field: "token",
    configPath: "channels.discord.token",
  },
  {
    envKey: "TELEGRAM_BOT_TOKEN",
    channelType: "telegram",
    field: "botToken",
    configPath: "channels.telegram.botToken",
  },
  {
    envKey: "SLACK_BOT_TOKEN",
    channelType: "slack",
    field: "botToken",
    configPath: "channels.slack.botToken",
  },
  {
    envKey: "SLACK_APP_TOKEN",
    channelType: "slack",
    field: "appToken",
    configPath: "channels.slack.appToken",
  },
];

/** Known API key prefix patterns for validation. Unknown providers pass freely. */
export const KEY_PREFIX_MAP: Record<string, string[]> = {
  anthropic: ["sk-ant-"],
  openai: ["sk-"],
  google: ["AI"],
};

/** Legacy env variable names for LLM providers (for migration cleanup). */
export const LEGACY_LLM_ENV_MAP: Record<string, string> = {
  anthropic: ENV_ANTHROPIC_API_KEY,
  openai: ENV_OPENAI_API_KEY,
};
