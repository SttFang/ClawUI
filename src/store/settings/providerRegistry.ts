import type { ProviderAuthInfo } from "@clawui/types/models";

export type OAuthMethod = "device-code" | "external-cli";

export interface ProviderDefinition {
  id: string;
  label: string;
  envKeys: string[];
  aliases?: string[];
  oauthMethod?: OAuthMethod;
}

const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    envKeys: ["ANTHROPIC_API_KEY", "ANTHROPIC_OAUTH_TOKEN"],
    oauthMethod: "external-cli",
  },
  { id: "openai", label: "OpenAI", envKeys: ["OPENAI_API_KEY"] },
  { id: "openai-codex", label: "OpenAI Codex", envKeys: [] },
  { id: "openrouter", label: "OpenRouter", envKeys: ["OPENROUTER_API_KEY"] },
  { id: "google", label: "Google Gemini", envKeys: ["GEMINI_API_KEY"], aliases: ["gemini"] },
  { id: "google-vertex", label: "Google Vertex", envKeys: [] },
  { id: "google-antigravity", label: "Google Antigravity", envKeys: [] },
  { id: "google-gemini-cli", label: "Google Gemini CLI", envKeys: [] },
  {
    id: "zai",
    label: "Z.AI",
    envKeys: ["ZAI_API_KEY", "Z_AI_API_KEY"],
    aliases: ["z.ai", "z-ai", "glm"],
  },
  { id: "xai", label: "xAI", envKeys: ["XAI_API_KEY"] },
  { id: "groq", label: "Groq", envKeys: ["GROQ_API_KEY"] },
  { id: "cerebras", label: "Cerebras", envKeys: ["CEREBRAS_API_KEY"] },
  { id: "mistral", label: "Mistral", envKeys: ["MISTRAL_API_KEY"] },
  { id: "opencode", label: "OpenCode Zen", envKeys: ["OPENCODE_API_KEY", "OPENCODE_ZEN_API_KEY"] },
  { id: "moonshot", label: "Moonshot", envKeys: ["MOONSHOT_API_KEY"] },
  { id: "kimi-coding", label: "Kimi Coding", envKeys: ["KIMI_API_KEY", "KIMICODE_API_KEY"] },
  { id: "minimax", label: "MiniMax", envKeys: ["MINIMAX_API_KEY"] },
  { id: "minimax-portal", label: "MiniMax OAuth", envKeys: [], oauthMethod: "external-cli" },
  { id: "qwen-portal", label: "Qwen OAuth", envKeys: [], oauthMethod: "external-cli" },
  { id: "qianfan", label: "Qianfan", envKeys: ["QIANFAN_API_KEY"] },
  { id: "together", label: "Together AI", envKeys: ["TOGETHER_API_KEY"] },
  { id: "vercel-ai-gateway", label: "Vercel AI Gateway", envKeys: ["AI_GATEWAY_API_KEY"] },
  {
    id: "cloudflare-ai-gateway",
    label: "Cloudflare AI Gateway",
    envKeys: ["CLOUDFLARE_AI_GATEWAY_API_KEY"],
  },
  { id: "venice", label: "Venice AI", envKeys: ["VENICE_API_KEY"] },
  { id: "synthetic", label: "Synthetic", envKeys: ["SYNTHETIC_API_KEY"] },
  { id: "xiaomi", label: "Xiaomi", envKeys: ["XIAOMI_API_KEY"] },
  {
    id: "github-copilot",
    label: "GitHub Copilot",
    envKeys: ["COPILOT_GITHUB_TOKEN", "GH_TOKEN", "GITHUB_TOKEN"],
    oauthMethod: "device-code",
  },
  { id: "chutes", label: "Chutes", envKeys: ["CHUTES_OAUTH_TOKEN", "CHUTES_API_KEY"] },
  {
    id: "amazon-bedrock",
    label: "Amazon Bedrock",
    envKeys: ["AWS_BEARER_TOKEN_BEDROCK", "AWS_ACCESS_KEY_ID", "AWS_PROFILE"],
    aliases: ["bedrock"],
  },
  { id: "ollama", label: "Ollama", envKeys: ["OLLAMA_API_KEY"] },
];

const FALLBACK_PROVIDER_IDS: string[] = [
  "anthropic",
  "openai",
  "openai-codex",
  "openrouter",
  "google",
  "xai",
  "groq",
  "mistral",
  "moonshot",
  "kimi-coding",
  "zai",
  "qianfan",
  "together",
  "opencode",
  "vercel-ai-gateway",
  "venice",
  "minimax",
  "qwen-portal",
  "github-copilot",
  "amazon-bedrock",
  "ollama",
];

const definitionMap = new Map<string, ProviderDefinition>();
const aliasMap = new Map<string, string>();

for (const definition of PROVIDER_DEFINITIONS) {
  definitionMap.set(definition.id, definition);
  aliasMap.set(definition.id, definition.id);
  for (const alias of definition.aliases ?? []) {
    aliasMap.set(alias, definition.id);
  }
}

function toProviderKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/_/g, "-");
}

function toTitleCaseLabel(providerId: string): string {
  return providerId
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function normalizeProviderId(providerId: string): string {
  const key = toProviderKey(providerId);
  if (!key) return "";

  if (aliasMap.has(key)) {
    return aliasMap.get(key) ?? key;
  }

  if (key.startsWith("community/")) return key;
  if (key === "openai-codex") return key;

  return key;
}

export function getProviderDefinition(providerId: string): ProviderDefinition | null {
  const normalized = normalizeProviderId(providerId);
  return definitionMap.get(normalized) ?? null;
}

export function getProviderLabel(providerId: string): string {
  const definition = getProviderDefinition(providerId);
  if (definition) return definition.label;
  const normalized = normalizeProviderId(providerId);
  return normalized ? toTitleCaseLabel(normalized) : providerId;
}

export function getProviderEnvKeys(providerId: string): string[] {
  const definition = getProviderDefinition(providerId);
  return definition ? [...definition.envKeys] : [];
}

export function getProviderOAuthMethod(providerId: string): OAuthMethod | undefined {
  const definition = getProviderDefinition(providerId);
  return definition?.oauthMethod;
}

export function getFallbackProviderIds(): string[] {
  return [...FALLBACK_PROVIDER_IDS];
}

export function getKnownProviderIds(): string[] {
  return PROVIDER_DEFINITIONS.map((definition) => definition.id);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function extractEnvVarFromSource(source: string): string | null {
  const match = source.match(/(?:^|\s)(?:shell env|env):\s*([A-Z0-9_]+)/i);
  if (!match?.[1]) return null;
  return match[1];
}

type ProviderAuthWithEnv = ProviderAuthInfo & {
  env?: {
    source?: string;
  };
};

export function resolveProviderEnvKey(params: {
  providerId: string;
  authInfo?: ProviderAuthInfo | null;
}): string | null {
  const { providerId, authInfo } = params;

  const extended = authInfo as ProviderAuthWithEnv | undefined;
  const envSource = readString(extended?.env?.source);
  if (envSource) {
    const envVar = extractEnvVarFromSource(envSource);
    if (envVar) return envVar;
  }

  const envKeys = getProviderEnvKeys(providerId);
  return envKeys.length > 0 ? envKeys[0] : null;
}

export function getApiKeyInputValue(apiKeys: Record<string, string>, providerId: string): string {
  const normalized = normalizeProviderId(providerId);
  if (!normalized) return "";
  return apiKeys[normalized] ?? "";
}

export function setApiKeyInputValue(
  apiKeys: Record<string, string>,
  providerId: string,
  value: string,
): Record<string, string> {
  const normalized = normalizeProviderId(providerId);
  if (!normalized) return apiKeys;
  return {
    ...apiKeys,
    [normalized]: value,
  };
}
