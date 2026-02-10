import type { ComponentType } from "react";
import OpenRouter from "@lobehub/icons/es/OpenRouter";
import { FaAws, FaMicrosoft } from "react-icons/fa";
import { SiAnthropic, SiGooglegemini, SiGoogle, SiMeta, SiOpenai } from "react-icons/si";

export type BrandIcon = ComponentType<{ size?: number; className?: string }>;

const PROVIDER_ICONS: Record<string, BrandIcon> = {
  anthropic: SiAnthropic,
  openai: SiOpenai,
  "openai-codex": SiOpenai,
  openrouter: OpenRouter, // no SimpleIcons logo in react-icons (as of 2026-02-10)
  google: SiGoogle,
  gemini: SiGooglegemini,
  meta: SiMeta,
  aws: FaAws,
  amazon: FaAws,
  microsoft: FaMicrosoft,
  azure: FaMicrosoft,
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
