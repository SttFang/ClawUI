import {
  Anthropic,
  Aws,
  Azure,
  AzureAI,
  Baidu,
  Bedrock,
  Cerebras,
  Cloudflare,
  DeepSeek,
  Gemini,
  GithubCopilot,
  GLMV,
  Google,
  GoogleCloud,
  Grok,
  Groq,
  Kimi,
  Meta,
  Minimax,
  Mistral,
  Moonshot,
  Ollama,
  OpenAI,
  OpenClaw,
  OpenRouter,
  Qwen,
  Together,
  Vercel,
  VertexAI,
  XAI,
  XiaomiMiMo,
} from "@lobehub/icons";
import { createElement, type ComponentType } from "react";
import type { BrandIcon } from "@/lib/iconifyBrandIcon";

type LobeIconLike = ComponentType<{ size?: number | string; className?: string }> & {
  Color?: ComponentType<{ size?: number | string; className?: string }>;
};

function createLobeBrandIcon(icon: LobeIconLike): BrandIcon {
  const Preferred = (icon.Color ?? icon) as ComponentType<{
    size?: number | string;
    className?: string;
  }>;
  const Wrapped: BrandIcon = ({ size = 20, className }) =>
    createElement(Preferred, { size, className });
  return Wrapped;
}

const PROVIDER_ICONS: Record<string, BrandIcon> = {
  anthropic: createLobeBrandIcon(Anthropic),
  openai: createLobeBrandIcon(OpenAI),
  "openai-codex": createLobeBrandIcon(OpenAI),
  openclaw: createLobeBrandIcon(OpenClaw),
  openrouter: createLobeBrandIcon(OpenRouter),
  google: createLobeBrandIcon(Google),
  gemini: createLobeBrandIcon(Gemini),
  "google-vertex": createLobeBrandIcon(VertexAI),
  "google-antigravity": createLobeBrandIcon(GoogleCloud),
  "google-gemini-cli": createLobeBrandIcon(GoogleCloud),
  meta: createLobeBrandIcon(Meta),
  aws: createLobeBrandIcon(Aws),
  amazon: createLobeBrandIcon(Aws),
  bedrock: createLobeBrandIcon(Bedrock),
  "amazon-bedrock": createLobeBrandIcon(Bedrock),
  microsoft: createLobeBrandIcon(Azure),
  azure: createLobeBrandIcon(Azure),
  "azure-ai": createLobeBrandIcon(AzureAI),
  xai: createLobeBrandIcon(XAI),
  grok: createLobeBrandIcon(Grok),
  groq: createLobeBrandIcon(Groq),
  mistral: createLobeBrandIcon(Mistral),
  moonshot: createLobeBrandIcon(Moonshot),
  "kimi-coding": createLobeBrandIcon(Moonshot),
  kimi: createLobeBrandIcon(Kimi),
  minimax: createLobeBrandIcon(Minimax),
  qwen: createLobeBrandIcon(Qwen),
  "qwen-portal": createLobeBrandIcon(Qwen),
  qianfan: createLobeBrandIcon(Baidu),
  zai: createLobeBrandIcon(GLMV),
  glm: createLobeBrandIcon(GLMV),
  together: createLobeBrandIcon(Together),
  "vercel-ai-gateway": createLobeBrandIcon(Vercel),
  "cloudflare-ai-gateway": createLobeBrandIcon(Cloudflare),
  cerebras: createLobeBrandIcon(Cerebras),
  ollama: createLobeBrandIcon(Ollama),
  "github-copilot": createLobeBrandIcon(GithubCopilot),
  xiaomi: createLobeBrandIcon(XiaomiMiMo),
  deepseek: createLobeBrandIcon(DeepSeek),
};

const EXACT_ALIASES = new Map<string, string>([
  ["openai codex", "openai-codex"],
  ["openai-codex", "openai-codex"],
  ["openai", "openai"],
  ["anthropic", "anthropic"],
  ["claude", "anthropic"],
  ["openrouter", "openrouter"],
  ["google-vertex", "google-vertex"],
  ["vertex", "google-vertex"],
  ["google-antigravity", "google-antigravity"],
  ["google-gemini-cli", "google-gemini-cli"],
  ["xai", "xai"],
  ["grok", "grok"],
  ["qwen-portal", "qwen-portal"],
  ["amazon-bedrock", "amazon-bedrock"],
  ["bedrock", "bedrock"],
  ["github-copilot", "github-copilot"],
  ["vercel-ai-gateway", "vercel-ai-gateway"],
  ["ai-gateway", "vercel-ai-gateway"],
  ["cloudflare-ai-gateway", "cloudflare-ai-gateway"],
]);

export function normalizeProviderKey(input: string): string {
  const raw = String(input ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return "";

  // O(1) exact match.
  const exact = EXACT_ALIASES.get(raw);
  if (exact) return exact;

  // Heuristics for provider names coming from usage aggregation / model refs.
  if (raw.includes("anthropic") || raw.includes("claude")) return "anthropic";
  if (raw.includes("openai")) return raw.includes("codex") ? "openai-codex" : "openai";
  if (raw.includes("openrouter")) return "openrouter";
  if (raw.includes("github") && raw.includes("copilot")) return "github-copilot";
  if (raw.includes("qwen")) return raw.includes("portal") ? "qwen-portal" : "qwen";
  if (raw.includes("gemini")) return "gemini";
  if (raw.includes("vertex")) return "google-vertex";
  if (raw.includes("google")) return "google";
  if (raw.includes("grok")) return "grok";
  if (raw.includes("xai")) return "xai";
  if (raw.includes("groq")) return "groq";
  if (raw.includes("mistral")) return "mistral";
  if (raw.includes("moonshot")) return "moonshot";
  if (raw.includes("kimi")) return raw.includes("coding") ? "kimi-coding" : "kimi";
  if (raw.includes("minimax")) return "minimax";
  if (raw.includes("qianfan") || raw.includes("baidu")) return "qianfan";
  if (raw.includes("zai") || raw.includes("glm")) return "zai";
  if (raw.includes("together")) return "together";
  if (raw.includes("vercel") || raw.includes("ai-gateway")) return "vercel-ai-gateway";
  if (raw.includes("cloudflare")) return "cloudflare-ai-gateway";
  if (raw.includes("cerebras")) return "cerebras";
  if (raw.includes("deepseek")) return "deepseek";
  if (raw.includes("ollama")) return "ollama";
  if (raw.includes("xiaomi") || raw.includes("mimo")) return "xiaomi";
  if (raw.includes("azure")) return "azure";
  if (raw.includes("microsoft")) return "microsoft";
  if (raw.includes("bedrock")) return "bedrock";
  if (raw.includes("aws") || raw.includes("amazon")) return "aws";
  if (raw.includes("meta") || raw.includes("llama")) return "meta";

  // Fallback: keep a stable-ish key for unknown providers.
  return raw.replace(/[^a-z0-9-]/g, "");
}

export function getProviderBrandIcon(provider: string): BrandIcon | null {
  const key = normalizeProviderKey(provider);
  return PROVIDER_ICONS[key] ?? null;
}
