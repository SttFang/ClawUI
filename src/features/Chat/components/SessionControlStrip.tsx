import { Button, Input, Select } from "@clawui/ui";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ipc } from "@/lib/ipc";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/chat";

type GatewaySessionsDefaults = {
  contextTokens?: number | null;
};

type GatewaySessionRow = {
  key: string;
  kind?: "direct" | "group" | "global" | "unknown";
  label?: string;
  updatedAt?: number | null;
  totalTokens?: number;
  contextTokens?: number;
  thinkingLevel?: string;
  verboseLevel?: string;
  reasoningLevel?: string;
};

type SessionsListResult = {
  defaults?: GatewaySessionsDefaults;
  sessions?: GatewaySessionRow[];
};

const THINKING_OPTIONS = ["inherit", "off", "minimal", "low", "medium", "high", "xhigh"] as const;
const VERBOSE_OPTIONS = ["inherit", "off", "on", "full"] as const;
const REASONING_OPTIONS = ["inherit", "off", "on", "stream"] as const;

function formatRelativeTime(updatedAt: number | null | undefined): string {
  if (!updatedAt || !Number.isFinite(updatedAt)) return "—";
  const diffMs = Date.now() - updatedAt;
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d`;
}

function toSelectValue(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return "inherit";
}

function toPatchValue(value: string): string | null {
  return value === "inherit" ? null : value;
}

export function SessionControlStrip(props: { sessionKey: string; disabled: boolean; className?: string }) {
  const { sessionKey, disabled, className } = props;
  const { t } = useTranslation("chat");

  const refreshSessions = useChatStore((s) => s.refreshSessions);

  const [row, setRow] = useState<GatewaySessionRow | null>(null);
  const [defaults, setDefaults] = useState<GatewaySessionsDefaults | null>(null);
  const [saving, setSaving] = useState(false);
  const [localLabel, setLocalLabel] = useState("");

  const load = useCallback(async () => {
    if (!sessionKey.trim()) return;
    try {
      const connected = await ipc.chat.isConnected();
      if (!connected) {
        const ok = await ipc.chat.connect();
        if (!ok) return;
      }
      const payload = (await ipc.chat.request("sessions.list", {
        // `search` will match by key; keep limit small.
        search: sessionKey,
        limit: 10,
        includeDerivedTitles: true,
        includeLastMessage: false,
        includeGlobal: true,
        includeUnknown: true,
      })) as SessionsListResult;

      const sessions = Array.isArray(payload?.sessions) ? payload.sessions : [];
      const match = sessions.find((s) => s?.key === sessionKey) ?? sessions[0] ?? null;
      setDefaults(payload?.defaults ?? null);
      setRow(match);
      setLocalLabel(typeof match?.label === "string" ? match.label : "");
    } catch {
      // best-effort only
    }
  }, [sessionKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const tokensText = useMemo(() => {
    const total = row?.totalTokens;
    const ctx =
      row?.contextTokens ??
      (typeof defaults?.contextTokens === "number" ? defaults?.contextTokens : null);
    const left = typeof total === "number" && Number.isFinite(total) ? String(total) : "—";
    const right = typeof ctx === "number" && Number.isFinite(ctx) ? String(ctx) : "—";
    return `${left} / ${right}`;
  }, [row?.totalTokens, row?.contextTokens, defaults?.contextTokens]);

  const patch = useCallback(
    async (partial: Record<string, unknown>) => {
      if (disabled) return;
      setSaving(true);
      try {
        await ipc.chat.request("sessions.patch", { key: sessionKey, ...partial });
        await refreshSessions();
        await load();
      } finally {
        setSaving(false);
      }
    },
    [disabled, load, refreshSessions, sessionKey],
  );

  const commitLabel = useCallback(async () => {
    if (disabled) return;
    const trimmed = localLabel.trim();
    const current = (typeof row?.label === "string" ? row.label : "").trim();
    if (trimmed === current) return;
    await patch({ label: trimmed ? trimmed : null });
  }, [disabled, localLabel, patch, row?.label]);

  const handleDelete = useCallback(async () => {
    if (disabled) return;
    const ok = window.confirm(t("sessionStrip.confirmDelete"));
    if (!ok) return;
    setSaving(true);
    try {
      await ipc.chat.request("sessions.delete", { key: sessionKey, deleteTranscript: false });
      await refreshSessions();
    } finally {
      setSaving(false);
    }
  }, [disabled, refreshSessions, sessionKey, t]);

  const kind = row?.kind ?? null;
  const updatedText = formatRelativeTime(row?.updatedAt ?? null);

  const thinkingValue = toSelectValue(row?.thinkingLevel);
  const verboseValue = toSelectValue(row?.verboseLevel);
  const reasoningValue = toSelectValue(row?.reasoningLevel);

  // Keep the strip usable on narrow windows: wrap instead of forcing horizontal scrolling.
  return (
    <div className={cn("flex flex-wrap items-end gap-2", disabled && "opacity-60", className)}>
      <div className="min-w-[220px] flex-1">
        <div className="text-[11px] text-muted-foreground">{t("sessionStrip.label")}</div>
        <Input
          value={localLabel}
          onChange={(e) => setLocalLabel(e.target.value)}
          onBlur={() => void commitLabel()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          placeholder={t("sessionStrip.optional")}
          disabled={disabled || saving}
          className="h-8 text-xs"
        />
      </div>

      <div className="min-w-[90px]">
        <div className="text-[11px] text-muted-foreground">{t("sessionStrip.kind")}</div>
        <div className="h-8 rounded-md border bg-background px-2 text-xs flex items-center">
          {kind ?? "—"}
        </div>
      </div>

      <div className="min-w-[90px]">
        <div className="text-[11px] text-muted-foreground">{t("sessionStrip.updated")}</div>
        <div className="h-8 rounded-md border bg-background px-2 text-xs flex items-center">
          {updatedText}
        </div>
      </div>

      <div className="min-w-[120px]">
        <div className="text-[11px] text-muted-foreground">{t("sessionStrip.tokens")}</div>
        <div className="h-8 rounded-md border bg-background px-2 text-xs flex items-center tabular-nums">
          {tokensText}
        </div>
      </div>

      <div className="min-w-[140px]">
        <div className="text-[11px] text-muted-foreground">{t("sessionStrip.thinking")}</div>
        <Select
          value={thinkingValue}
          onChange={(e) => void patch({ thinkingLevel: toPatchValue(e.target.value) })}
          disabled={disabled || saving}
          className="h-8 px-2 text-xs"
        >
          {THINKING_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v === "inherit" ? t("sessionStrip.inherit") : v}
            </option>
          ))}
        </Select>
      </div>

      <div className="min-w-[120px]">
        <div className="text-[11px] text-muted-foreground">{t("sessionStrip.verbose")}</div>
        <Select
          value={verboseValue}
          onChange={(e) => void patch({ verboseLevel: toPatchValue(e.target.value) })}
          disabled={disabled || saving}
          className="h-8 px-2 text-xs"
        >
          {VERBOSE_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v === "inherit" ? t("sessionStrip.inherit") : v}
            </option>
          ))}
        </Select>
      </div>

      <div className="min-w-[130px]">
        <div className="text-[11px] text-muted-foreground">{t("sessionStrip.reasoning")}</div>
        <Select
          value={reasoningValue}
          onChange={(e) => void patch({ reasoningLevel: toPatchValue(e.target.value) })}
          disabled={disabled || saving}
          className="h-8 px-2 text-xs"
        >
          {REASONING_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v === "inherit" ? t("sessionStrip.inherit") : v}
            </option>
          ))}
        </Select>
      </div>

      <div className="min-w-[110px]">
        <div className="text-[11px] text-muted-foreground">{t("sessionStrip.actions")}</div>
        <Button
          variant="destructive"
          size="sm"
          className="h-8 w-full"
          onClick={() => void handleDelete()}
          disabled={disabled || saving}
        >
          <Trash2 className="h-4 w-4" />
          {t("sessionStrip.delete")}
        </Button>
      </div>
    </div>
  );
}
