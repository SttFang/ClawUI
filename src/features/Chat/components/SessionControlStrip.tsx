import { Select } from "@clawui/ui";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ipc } from "@/lib/ipc";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/chat";

type GatewaySessionsDefaults = {
  // Keep for forward-compat; currently unused in this component.
  contextTokens?: number | null;
};

type GatewaySessionRow = {
  key: string;
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

function toSelectValue(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return "inherit";
}

function toPatchValue(value: string): string | null {
  return value === "inherit" ? null : value;
}

function formatOptionLabel(t: (key: string) => string, v: string): string {
  if (v === "inherit") return t("sessionStrip.inherit");
  switch (v) {
    case "off":
      return t("sessionStrip.option.off");
    case "on":
      return t("sessionStrip.option.on");
    case "stream":
      return t("sessionStrip.option.stream");
    case "full":
      return t("sessionStrip.option.full");
    case "minimal":
      return t("sessionStrip.option.minimal");
    case "low":
      return t("sessionStrip.option.low");
    case "medium":
      return t("sessionStrip.option.medium");
    case "high":
      return t("sessionStrip.option.high");
    case "xhigh":
      return t("sessionStrip.option.xhigh");
    default:
      return v;
  }
}

export function SessionControlStrip(props: {
  sessionKey: string;
  disabled: boolean;
  className?: string;
}) {
  const { sessionKey, disabled, className } = props;
  const { t } = useTranslation("chat");

  const refreshSessions = useChatStore((s) => s.refreshSessions);

  const [row, setRow] = useState<GatewaySessionRow | null>(null);
  const [saving, setSaving] = useState(false);

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
      setRow(match);
    } catch {
      // best-effort only
    }
  }, [sessionKey]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const thinkingValue = toSelectValue(row?.thinkingLevel);
  const verboseValue = toSelectValue(row?.verboseLevel);
  const reasoningValue = toSelectValue(row?.reasoningLevel);

  return (
    <div
      className={cn(
        "flex min-w-0 flex-nowrap items-center gap-1.5",
        disabled && "opacity-60",
        className,
      )}
    >
      <div className="flex items-center gap-1">
        <div className="whitespace-nowrap text-[11px] text-muted-foreground">
          {t("sessionStrip.thinking")}
        </div>
        <Select
          value={thinkingValue}
          onChange={(e) => void patch({ thinkingLevel: toPatchValue(e.target.value) })}
          disabled={disabled || saving}
          aria-label={t("sessionStrip.thinking")}
          className="h-8 w-[92px] px-1.5 pr-7 text-[11px]"
        >
          {THINKING_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {formatOptionLabel(t, v)}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-1">
        <div className="whitespace-nowrap text-[11px] text-muted-foreground">
          {t("sessionStrip.verbose")}
        </div>
        <Select
          value={verboseValue}
          onChange={(e) => void patch({ verboseLevel: toPatchValue(e.target.value) })}
          disabled={disabled || saving}
          aria-label={t("sessionStrip.verbose")}
          className="h-8 w-[76px] px-1.5 pr-7 text-[11px]"
        >
          {VERBOSE_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {formatOptionLabel(t, v)}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-1">
        <div className="whitespace-nowrap text-[11px] text-muted-foreground">
          {t("sessionStrip.reasoning")}
        </div>
        <Select
          value={reasoningValue}
          onChange={(e) => void patch({ reasoningLevel: toPatchValue(e.target.value) })}
          disabled={disabled || saving}
          aria-label={t("sessionStrip.reasoning")}
          className="h-8 w-[76px] px-1.5 pr-7 text-[11px]"
        >
          {REASONING_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {formatOptionLabel(t, v)}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
