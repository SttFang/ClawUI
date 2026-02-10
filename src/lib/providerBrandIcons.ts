import aws from "@iconify/icons-logos/aws";
import azureIcon from "@iconify/icons-logos/azure-icon";
import googleBardIcon from "@iconify/icons-logos/google-bard-icon";
import googleIcon from "@iconify/icons-logos/google-icon";
import microsoftIcon from "@iconify/icons-logos/microsoft-icon";
import openaiIcon from "@iconify/icons-logos/openai-icon";
import OpenRouter from "@lobehub/icons/es/OpenRouter";
import { SiAnthropic, SiMeta } from "react-icons/si";
import { createIconifyBrandIcon, type BrandIcon } from "@/lib/iconifyBrandIcon";

const PROVIDER_ICONS: Record<string, BrandIcon> = {
  anthropic: SiAnthropic, // no multi-color logo in @iconify/icons-logos right now
  openai: createIconifyBrandIcon(openaiIcon),
  "openai-codex": createIconifyBrandIcon(openaiIcon),
  openrouter: OpenRouter, // no SimpleIcons logo in react-icons (as of 2026-02-10)
  google: createIconifyBrandIcon(googleIcon),
  gemini: createIconifyBrandIcon(googleBardIcon),
  meta: SiMeta, // Meta logo is typically monochrome/1-color
  aws: createIconifyBrandIcon(aws),
  amazon: createIconifyBrandIcon(aws),
  microsoft: createIconifyBrandIcon(microsoftIcon),
  azure: createIconifyBrandIcon(azureIcon),
};

export function normalizeProviderKey(input: string): string {
  const raw = String(input ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return "";

  // Common aliases (UI labels vs provider ids).
  if (raw === "openai codex") return "openai-codex";
  if (raw === "openai") return "openai";
  if (raw === "anthropic") return "anthropic";
  if (raw === "openrouter") return "openrouter";

  // Heuristics for provider names coming from usage aggregation.
  if (raw.includes("anthropic")) return "anthropic";
  if (raw.includes("openai")) return raw.includes("codex") ? "openai-codex" : "openai";
  if (raw.includes("openrouter")) return "openrouter";
  if (raw.includes("gemini")) return "gemini";
  if (raw.includes("google")) return "google";
  if (raw.includes("azure")) return "azure";
  if (raw.includes("microsoft")) return "microsoft";
  if (raw.includes("aws") || raw.includes("amazon") || raw.includes("bedrock")) return "aws";
  if (raw.includes("meta") || raw.includes("llama")) return "meta";

  // Fallback: keep a stable-ish key for unknown providers.
  return raw.replace(/[^a-z0-9-]/g, "");
}

export function getProviderBrandIcon(provider: string): BrandIcon | null {
  const key = normalizeProviderKey(provider);
  return PROVIDER_ICONS[key] ?? null;
}
