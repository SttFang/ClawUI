import type { IpcMain } from "electron";
import { execFile } from "child_process";
import { promisify } from "util";
import type { ClawUIStateService, ClawUISessionMetadata } from "../services/clawui-state";
import type { ConfigService } from "../services/config";
import type { OpenClawProfilesService } from "../services/openclaw-profiles";
import { mainLog } from "../lib/logger";
import { chatWebSocket } from "../services/chat-websocket";
import { ensureGatewayConnected } from "../utils/ensure-connected";
import { resolveCommandPath } from "../utils/login-shell";

const execFileAsync = promisify(execFile);

function coerceSessionKey(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const key = input.trim();
  if (!key) return null;
  // Keep it permissive; OpenClaw accepts various key formats.
  if (key.length > 200) return null;
  return key;
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  // 1) fenced ```json ... ```
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1] ?? text;
  // 2) best-effort: from first { to last }
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toMetadata(now: number, obj: Record<string, unknown>): ClawUISessionMetadata | null {
  const title = typeof obj.title === "string" ? obj.title.trim() : "";
  const summary = typeof obj.summary === "string" ? obj.summary.trim() : "";
  const tags = Array.isArray(obj.tags)
    ? obj.tags
        .filter((t) => typeof t === "string")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  const icon = typeof obj.icon === "string" ? obj.icon.trim() : undefined;

  if (!title || !summary) return null;

  return {
    title: title.slice(0, 80),
    summary: summary.slice(0, 240),
    tags: tags.slice(0, 8),
    icon,
    generatedAt: now,
    generator: { profileId: "configAgent" },
  };
}

async function runOpenClawJson(
  args: string[],
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<unknown> {
  const openclawPath = await resolveCommandPath("openclaw");
  if (!openclawPath) throw new Error("openclaw not found in PATH");

  const res = await execFileAsync(openclawPath, args, {
    env: { ...process.env, ...env },
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
    encoding: "utf8",
  });

  const stdout = String(res.stdout ?? "").trim();
  if (!stdout) throw new Error("openclaw produced no output");
  return JSON.parse(stdout) as unknown;
}

export function registerMetadataHandlers(
  ipcMain: IpcMain,
  options: {
    stateService: ClawUIStateService;
    profilesService: OpenClawProfilesService;
    mainConfigService: ConfigService;
  },
): void {
  const { stateService, profilesService, mainConfigService } = options;

  ipcMain.handle(
    "metadata:generate",
    async (_event, sessionKeyInput: unknown): Promise<ClawUISessionMetadata> => {
      const sessionKey = coerceSessionKey(sessionKeyInput);
      if (!sessionKey) throw new Error("Invalid sessionKey");

      const t0 = Date.now();
      const now = Date.now();

      // Ensure both profiles exist before we try to read env from the config-agent profile.
      await profilesService.initialize();
      await ensureGatewayConnected(mainConfigService);

      const preview = await chatWebSocket.request("sessions.preview", {
        keys: [sessionKey],
        limit: 40,
        maxChars: 8000,
      });

      const previewJson = JSON.stringify(preview, null, 2);

      const prompt = [
        "你是 ClawUI 的会话命名助手。请根据给定的 OpenClaw 会话预览信息，生成一个便于人类理解的名称与简介。",
        "",
        "要求：",
        "- 只输出严格 JSON（不要 markdown、不要解释、不要多余文本）。",
        "- 字段：title（<= 30字），summary（<= 80字），tags（1-6个短标签），icon（可选，emoji）。",
        "- title/summary/tags 使用中文。",
        "",
        `sessionKey: ${sessionKey}`,
        "",
        "sessionPreview(JSON):",
        previewJson,
      ].join("\n");

      const configAgentConfig = await profilesService.getConfig("configAgent");
      const env = (configAgentConfig as { env?: Record<string, string> })?.env ?? {};

      // Run the config-agent locally so it never needs direct access to the main gateway.
      const result = await runOpenClawJson(
        [
          "--profile",
          "clawui-config-agent",
          "agent",
          "--local",
          "--agent",
          "main",
          "--session-id",
          `clawui:meta:${sessionKey}`,
          "--message",
          prompt,
          "--json",
          "--timeout",
          "120",
        ],
        env,
        140_000,
      );

      const payloads = (result as { payloads?: unknown }).payloads;
      const firstText =
        Array.isArray(payloads) &&
        payloads[0] &&
        typeof (payloads[0] as { text?: unknown }).text === "string"
          ? String((payloads[0] as { text?: unknown }).text)
          : "";

      const jsonObj = extractJsonObject(firstText);
      const meta = jsonObj ? toMetadata(now, jsonObj) : null;
      const finalMeta: ClawUISessionMetadata =
        meta ??
        ({
          title: sessionKey,
          summary: "metadata generation failed",
          tags: [],
          generatedAt: now,
          generator: { profileId: "configAgent" },
          error: "Failed to parse metadata JSON from config agent output",
          nextRetryAt: now + 30_000,
        } satisfies ClawUISessionMetadata);

      await stateService.patch({
        sessions: { metadata: { [sessionKey]: finalMeta } },
      });

      mainLog.info(
        "[metadata.generate]",
        `sessionKey=${sessionKey}`,
        `durationMs=${Date.now() - t0}`,
      );
      return finalMeta;
    },
  );
}
