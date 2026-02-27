import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@clawui/ui";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ipc } from "@/lib/ipc";
import { cn } from "@/lib/utils";
import { ensureChatConnected } from "@/services/chat/connection";
import { useChatStore } from "@/store/chat";

type GatewaySessionsDefaults = {
  // Keep for forward-compat; currently unused in this component.
  contextTokens?: number | null;
};

type GatewaySessionRow = {
  key: string;
  model?: string;
  thinkingLevel?: string;
  verboseLevel?: string;
  reasoningLevel?: string;
};

type GatewayModelChoice = {
  id?: string;
  provider?: string;
  key?: string;
  name?: string;
};

type SessionsListResult = {
  defaults?: GatewaySessionsDefaults;
  sessions?: GatewaySessionRow[];
};

type ModelsListResult = {
  models?: GatewayModelChoice[];
};

const THINKING_OPTIONS = ["inherit", "off", "minimal", "low", "medium", "high", "xhigh"] as const;
const VERBOSE_OPTIONS = ["inherit", "off", "on", "full"] as const;
const REASONING_OPTIONS = ["inherit", "off", "on", "stream"] as const;

function normalizeModelKey(choice: GatewayModelChoice): string {
  if (typeof choice.key === "string" && choice.key.trim()) return choice.key.trim();
  const provider = typeof choice.provider === "string" ? choice.provider.trim() : "";
  const id = typeof choice.id === "string" ? choice.id.trim() : "";
  if (provider && id) return `${provider}/${id}`;
  return id || provider;
}

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

/* ── Ghost trigger button ────────────────────────────────────── */

const triggerCn = cn(
  "inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-xs",
  "text-muted-foreground hover:bg-accent hover:text-foreground",
  "disabled:pointer-events-none disabled:opacity-50",
  "h-7 cursor-default outline-none",
);

function ControlDropdown(props: {
  label: string;
  triggerText: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={props.disabled}>
        <button className={triggerCn}>
          <span className="max-w-[160px] truncate">{props.triggerText}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{props.label}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={props.value} onValueChange={props.onChange}>
          {props.options.map((opt) => (
            <DropdownMenuRadioItem key={opt.value} value={opt.value}>
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Main component ──────────────────────────────────────────── */

export function SessionControlStrip(props: {
  sessionKey: string;
  disabled: boolean;
  className?: string;
}) {
  const { sessionKey, disabled, className } = props;
  const { t } = useTranslation("chat");

  const refreshSessions = useChatStore((s) => s.refreshSessions);

  const [row, setRow] = useState<GatewaySessionRow | null>(null);
  const [modelChoices, setModelChoices] = useState<
    Array<{ key: string; label: string; display: string }>
  >([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!sessionKey.trim()) return;
    try {
      await ensureChatConnected();
      const [sessionsPayload, modelsPayload] = (await Promise.all([
        ipc.chat.request("sessions.list", {
          search: sessionKey,
          limit: 10,
          includeDerivedTitles: true,
          includeLastMessage: false,
          includeGlobal: true,
          includeUnknown: true,
        }),
        ipc.chat.request("models.list"),
      ])) as [SessionsListResult, ModelsListResult];

      const sessions = Array.isArray(sessionsPayload?.sessions) ? sessionsPayload.sessions : [];
      const match = sessions.find((s) => s?.key === sessionKey) ?? sessions[0] ?? null;
      setRow(match);

      const models = Array.isArray(modelsPayload?.models) ? modelsPayload.models : [];
      const options = models
        .map((choice) => {
          const key = normalizeModelKey(choice);
          if (!key) return null;
          const name = typeof choice.name === "string" ? choice.name.trim() : "";
          return {
            key,
            label: name && name !== key ? `${key} (${name})` : key,
            display: name || key,
          };
        })
        .filter((item): item is { key: string; label: string; display: string } => Boolean(item));
      setModelChoices(options);
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
        // Optimistic update so the UI reflects the change immediately.
        setRow((prev) => (prev ? { ...prev, ...partial } as GatewaySessionRow : prev));
        await refreshSessions();
        await load();
      } finally {
        setSaving(false);
      }
    },
    [disabled, load, refreshSessions, sessionKey],
  );

  const isBusy = disabled || saving;
  const thinkingValue = toSelectValue(row?.thinkingLevel);
  const verboseValue = toSelectValue(row?.verboseLevel);
  const reasoningValue = toSelectValue(row?.reasoningLevel);
  const modelValue = toSelectValue(row?.model);

  // Trigger text helpers
  const modelTrigger =
    modelValue === "inherit"
      ? t("sessionStrip.inherit")
      : (modelChoices.find((m) => m.key === modelValue)?.display ?? modelValue);

  const labeledTrigger = (label: string, value: string) =>
    value === "inherit" ? label : `${label}\u00b7${formatOptionLabel(t, value)}`;

  // Build option lists
  const buildOptions = (opts: readonly string[]) =>
    opts.map((v) => ({ value: v, label: formatOptionLabel(t, v) }));

  const modelOptions: Array<{ value: string; label: string }> = [
    { value: "inherit", label: t("sessionStrip.inherit") },
    ...modelChoices.map((m) => ({ value: m.key, label: m.label })),
  ];

  return (
    <div
      className={cn(
        "flex min-w-0 flex-nowrap items-center gap-0.5",
        disabled && "opacity-60",
        className,
      )}
    >
      <ControlDropdown
        label={t("sessionStrip.model")}
        triggerText={modelTrigger}
        value={modelValue}
        options={modelOptions}
        disabled={isBusy}
        onChange={(v) => void patch({ model: toPatchValue(v) })}
      />

      <ControlDropdown
        label={t("sessionStrip.thinking")}
        triggerText={labeledTrigger(t("sessionStrip.thinking"), thinkingValue)}
        value={thinkingValue}
        options={buildOptions(THINKING_OPTIONS)}
        disabled={isBusy}
        onChange={(v) => void patch({ thinkingLevel: toPatchValue(v) })}
      />

      <ControlDropdown
        label={t("sessionStrip.verbose")}
        triggerText={labeledTrigger(t("sessionStrip.verbose"), verboseValue)}
        value={verboseValue}
        options={buildOptions(VERBOSE_OPTIONS)}
        disabled={isBusy}
        onChange={(v) => void patch({ verboseLevel: toPatchValue(v) })}
      />

      <ControlDropdown
        label={t("sessionStrip.reasoning")}
        triggerText={labeledTrigger(t("sessionStrip.reasoning"), reasoningValue)}
        value={reasoningValue}
        options={buildOptions(REASONING_OPTIONS)}
        disabled={isBusy}
        onChange={(v) => void patch({ reasoningLevel: toPatchValue(v) })}
      />
    </div>
  );
}
