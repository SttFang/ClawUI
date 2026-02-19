import type { Session } from "./initialState";

let messageIdCounter = 0;
export const generateMessageId = () => `msg_${Date.now()}_${messageIdCounter++}`;

const DEFAULT_UI_SESSION_PREFIX = "agent:main:ui";
/** Gateway normalizes "main" → "agent:main:main", matching heartbeat's session. */
export const MAIN_SESSION_KEY = "main";
const MAIN_SESSION_KEY_NORMALIZED = "agent:main:main";
export const isMainSessionKey = (id: string): boolean =>
  id === MAIN_SESSION_KEY || id === MAIN_SESSION_KEY_NORMALIZED;
/** Subagent sessions (e.g. "agent:main:subagent:xxx") should not appear in the sidebar. */
export const isSubagentSessionKey = (id: string): boolean => id.includes(":subagent:");
export const generateUiSessionKey = () => `${DEFAULT_UI_SESSION_PREFIX}:${generateChatRunId()}`;

let chatRunIdCounter = 0;
export const generateChatRunId = (): string => {
  const cryptoObj = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") return cryptoObj.randomUUID();

  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  const t = Date.now().toString(16).padStart(12, "0");
  const c = (chatRunIdCounter++).toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${t.slice(-12)}${c.slice(-12)}`.slice(0, 36);
};

export function parseSessionsListPayload(
  payload: unknown,
): Array<Pick<Session, "id" | "name" | "createdAt" | "updatedAt" | "surface">> {
  if (!payload || typeof payload !== "object") return [];
  const sessionsValue = (payload as { sessions?: unknown }).sessions;
  if (!Array.isArray(sessionsValue)) return [];

  const out: Array<Pick<Session, "id" | "name" | "createdAt" | "updatedAt" | "surface">> = [];
  for (const item of sessionsValue) {
    if (!item || typeof item !== "object") continue;
    const key = (item as { key?: unknown }).key;
    if (typeof key !== "string" || !key.trim()) continue;
    if (isSubagentSessionKey(key)) continue;

    const derivedTitle = (item as { derivedTitle?: unknown }).derivedTitle;
    const updatedAt = (item as { updatedAt?: unknown }).updatedAt;
    const surface =
      (item as { surface?: unknown }).surface ?? (item as { channel?: unknown }).channel;

    out.push({
      id: key,
      name: typeof derivedTitle === "string" && derivedTitle.trim() ? derivedTitle : key,
      createdAt: typeof updatedAt === "number" ? updatedAt : Date.now(),
      updatedAt: typeof updatedAt === "number" ? updatedAt : Date.now(),
      surface: typeof surface === "string" ? surface : null,
    });
  }

  out.sort((a, b) => b.updatedAt - a.updatedAt);
  return out;
}
