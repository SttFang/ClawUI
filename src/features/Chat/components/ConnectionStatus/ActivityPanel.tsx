import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  useGatewayActivityStore,
  selectLastTickAt,
  selectTickIntervalMs,
  selectTickCount,
  selectActivityEntries,
  type GatewayActivityEntry,
} from "@/store/gatewayActivity";
import { useTickHealth, useTickGapSeconds, type TickHealth } from "./useTickHealth";

const TICK_HEALTH_COLOR: Record<TickHealth, string> = {
  unknown: "bg-green-500",
  healthy: "bg-green-500",
  delayed: "bg-yellow-500",
  timeout: "bg-red-500",
};

const TICK_HEALTH_KEY: Record<TickHealth, string> = {
  unknown: "connection.panel.tickHealthy",
  healthy: "connection.panel.tickHealthy",
  delayed: "connection.panel.tickDelayed",
  timeout: "connection.panel.tickTimeout",
};

function TickSummary() {
  const { t } = useTranslation("common");
  const lastTickAt = useGatewayActivityStore(selectLastTickAt);
  const intervalMs = useGatewayActivityStore(selectTickIntervalMs);
  const tickCount = useGatewayActivityStore(selectTickCount);
  const health = useTickHealth(lastTickAt, intervalMs);
  const gapSeconds = useTickGapSeconds(lastTickAt);

  return (
    <div className="space-y-1 border-b pb-3">
      <div className="flex items-center gap-2">
        <div className={cn("h-2 w-2 rounded-full", TICK_HEALTH_COLOR[health])} />
        <span className="text-sm font-medium">{t(TICK_HEALTH_KEY[health])}</span>
        {gapSeconds != null && (
          <span className="text-xs text-muted-foreground">
            {t("connection.panel.lastTick", { seconds: gapSeconds })}
            {" · "}
            {t("connection.panel.interval", { interval: Math.round(intervalMs / 1000) })}
          </span>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        {t("connection.panel.tickSummary", { count: tickCount })}
      </div>
    </div>
  );
}

const EVENT_ICON: Record<string, string> = {
  heartbeat: "⚡",
  health: "🏥",
  "exec.approval.requested": "⏳",
  "exec.approval.resolved": "✅",
  shutdown: "🔴",
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

function EventRow({ entry }: { entry: GatewayActivityEntry }) {
  const icon =
    entry.event === "exec.approval.resolved" && entry.label.startsWith("deny")
      ? "❌"
      : (EVENT_ICON[entry.event] ?? "📌");

  return (
    <div className="flex gap-2 py-1 text-xs">
      <span className="shrink-0 text-muted-foreground">{formatTime(entry.ts)}</span>
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="font-medium">{entry.event}</div>
        <div className="truncate text-muted-foreground">{entry.label}</div>
      </div>
    </div>
  );
}

function EventList() {
  const { t } = useTranslation("common");
  const entries = useGatewayActivityStore(selectActivityEntries);
  // Show newest first: slice last 20 then iterate backwards
  const recent = entries.slice(-20);

  return (
    <div className="pt-3">
      <div className="mb-2 text-xs font-medium text-muted-foreground">
        {t("connection.panel.recentEvents")}
      </div>
      {recent.length === 0 ? (
        <div className="py-3 text-center text-xs text-muted-foreground">
          {t("connection.panel.noEvents")}
        </div>
      ) : (
        <div className="max-h-60 space-y-0.5 overflow-y-auto">
          {recent.map((_, i) => {
            const entry = recent[recent.length - 1 - i];
            return <EventRow key={entry.id} entry={entry} />;
          })}
        </div>
      )}
    </div>
  );
}

export function ActivityPanel() {
  const { t } = useTranslation("common");

  return (
    <div className="space-y-0">
      <div className="mb-3 text-sm font-semibold">{t("connection.panel.title")}</div>
      <TickSummary />
      <EventList />
    </div>
  );
}
