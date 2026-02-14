import type { DynamicToolUIPart } from "ai";
import { toRecord } from "@/lib/exec";

export function formatJson(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trimEnd()}…`;
}

export function extractSearchQuery(input: unknown): string {
  const record = toRecord(input);
  if (!record) return "";
  const candidates = [record.query, record.q, record.search, record.text, record.pattern];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "";
}

export function extractReadPath(input: unknown): string {
  const record = toRecord(input);
  if (!record) return "";
  const candidates = [record.path, record.filePath, record.filename, record.file];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "";
}

export function extractGlobPattern(input: unknown): string {
  const record = toRecord(input);
  if (!record) return "";
  const candidates = [record.pattern, record.glob];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "";
}

function shortenPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  if (parts.length <= 3) return normalized;
  return `…/${parts.slice(-2).join("/")}`;
}

function shortenUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.length > 30 ? `${url.slice(0, 30)}…` : url;
  }
}

function extractBrowserSummary(input: unknown): string {
  const record = toRecord(input);
  if (!record) return "browser";
  const action = typeof record.action === "string" ? record.action.trim() : "";
  const url = typeof record.targetUrl === "string" ? record.targetUrl.trim() : "";

  if (action === "navigate" || action === "open") {
    return url ? `browse ${shortenUrl(url)}` : `browser ${action}`;
  }
  if (action === "act") {
    const req = toRecord(record.request);
    const kind = req && typeof req.kind === "string" ? req.kind : "";
    return kind ? `browser ${kind}` : "browser act";
  }
  if (action === "screenshot") return "browser screenshot";
  if (action === "snapshot") return "browser snapshot";
  if (action) return `browser ${action}`;

  if (url) return `browse ${shortenUrl(url)}`;
  return "browser";
}

function extractWebSearchSummary(input: unknown): string {
  const query = extractSearchQuery(input);
  return query ? `search "${query}"` : "web search";
}

function buildGenericFallbackSummary(part: DynamicToolUIPart): string {
  const record = toRecord(part.input);
  const displayName = part.toolName.trim().replace(/_/g, " ");
  if (!record) return displayName;
  for (const key of ["action", "command", "query", "prompt", "url", "path", "name", "text"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      const trimmed = value.trim();
      const short = trimmed.length > 30 ? `${trimmed.slice(0, 30)}…` : trimmed;
      return `${displayName} ${short}`;
    }
  }
  return displayName;
}

export function buildToolSummary(part: DynamicToolUIPart): string {
  const name = part.toolName.trim().toLowerCase();

  if (name === "read") {
    const path = extractReadPath(part.input);
    return path ? `read ${shortenPath(path)}` : "read";
  }
  if (name === "search" || name === "grep") {
    const query = extractSearchQuery(part.input);
    return query ? `${name} "${query}"` : name;
  }
  if (name === "glob") {
    const pattern = extractGlobPattern(part.input);
    return pattern ? `glob ${pattern}` : "glob";
  }
  if (name === "list_dir") {
    const path = extractReadPath(part.input);
    return path ? `list ${shortenPath(path)}` : "list_dir";
  }
  if (name === "browser") {
    return extractBrowserSummary(part.input);
  }
  if (
    name === "web_search" ||
    name === "web-search" ||
    name === "web_research" ||
    name === "web-research"
  ) {
    return extractWebSearchSummary(part.input);
  }
  if (name === "navigate") {
    const record = toRecord(part.input);
    const url = record && typeof record.url === "string" ? record.url.trim() : "";
    return url ? `navigate ${shortenUrl(url)}` : "navigate";
  }
  if (name === "fetch" || name === "web_fetch") {
    const record = toRecord(part.input);
    const url = record && typeof record.url === "string" ? record.url.trim() : "";
    return url ? `fetch ${shortenUrl(url)}` : "fetch";
  }

  if (name === "memory_search") {
    const query = extractSearchQuery(part.input);
    return query ? `memory search "${query}"` : "memory search";
  }
  if (name === "memory_get") {
    const record = toRecord(part.input);
    const key = record && typeof record.key === "string" ? record.key.trim() : "";
    return key ? `memory get "${key}"` : "memory get";
  }
  if (name === "agents_list") {
    return "list agents";
  }
  if (name === "cron") {
    const record = toRecord(part.input);
    const action = record && typeof record.action === "string" ? record.action.trim() : "";
    const cronName = record && typeof record.name === "string" ? record.name.trim() : "";
    if (action && cronName) return `cron ${action} "${cronName}"`;
    if (action) return `cron ${action}`;
    return "cron";
  }
  if (name === "nodes") {
    const record = toRecord(part.input);
    const action = record && typeof record.action === "string" ? record.action.trim() : "";
    return action ? `nodes ${action}` : "nodes";
  }
  if (name === "canvas") {
    const record = toRecord(part.input);
    const action = record && typeof record.action === "string" ? record.action.trim() : "";
    return action ? `canvas ${action}` : "canvas";
  }
  if (name === "gateway") {
    const record = toRecord(part.input);
    const action = record && typeof record.action === "string" ? record.action.trim() : "";
    return action ? `gateway ${action}` : "gateway";
  }
  if (name === "message") {
    const record = toRecord(part.input);
    const to = record && typeof record.to === "string" ? record.to.trim() : "";
    return to ? `message ${to}` : "message";
  }
  if (name === "image") {
    const record = toRecord(part.input);
    const prompt = record && typeof record.prompt === "string" ? record.prompt.trim() : "";
    if (prompt) {
      const short = prompt.length > 30 ? `${prompt.slice(0, 30)}…` : prompt;
      return `image "${short}"`;
    }
    return "image";
  }
  if (name === "tts") {
    const record = toRecord(part.input);
    const text = record && typeof record.text === "string" ? record.text.trim() : "";
    if (text) {
      const short = text.length > 30 ? `${text.slice(0, 30)}…` : text;
      return `tts "${short}"`;
    }
    return "tts";
  }
  if (name === "sessions_send") {
    const record = toRecord(part.input);
    const sessionKey =
      record && typeof record.sessionKey === "string" ? record.sessionKey.trim() : "";
    return sessionKey ? `send to ${sessionKey}` : "sessions send";
  }
  if (name === "sessions_spawn") {
    const record = toRecord(part.input);
    const prompt = record && typeof record.prompt === "string" ? record.prompt.trim() : "";
    if (prompt) {
      const short = prompt.length > 30 ? `${prompt.slice(0, 30)}…` : prompt;
      return `spawn "${short}"`;
    }
    return "sessions spawn";
  }

  return buildGenericFallbackSummary(part);
}

export function getCwdFromInput(input: unknown): string | undefined {
  const record = toRecord(input);
  if (!record) return undefined;
  const cwd = record.cwd;
  if (typeof cwd !== "string") return undefined;
  const normalized = cwd.trim();
  return normalized || undefined;
}
