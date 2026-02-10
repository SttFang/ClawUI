import { Button, Select } from "@clawui/ui";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

interface UsageHeaderProps {
  startDate: string;
  endDate: string;
  chartMode: "tokens" | "cost";
  loading: boolean;
  onDateRangeChange: (start: string, end: string) => void;
  onChartModeChange: (mode: "tokens" | "cost") => void;
  onRefresh: () => void;
}

function daysAgoStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function UsageHeader({
  startDate,
  endDate,
  chartMode,
  loading,
  onDateRangeChange,
  onChartModeChange,
  onRefresh,
}: UsageHeaderProps) {
  const { t } = useTranslation("common");
  const today = todayStr();
  const presets = [
    { key: "today", label: t("usage.presets.today"), days: 0 },
    { key: "last7d", label: t("usage.presets.last7d"), days: 7 },
    { key: "last30d", label: t("usage.presets.last30d"), days: 30 },
  ];

  const activePreset = presets.find(
    (p) => endDate === today && startDate === (p.days === 0 ? today : daysAgoStr(p.days)),
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Date presets */}
      <div className="flex gap-1">
        {presets.map((p) => (
          <Button
            key={p.key}
            variant={activePreset?.days === p.days ? "default" : "outline"}
            size="sm"
            onClick={() => onDateRangeChange(p.days === 0 ? today : daysAgoStr(p.days), today)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Date inputs */}
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onDateRangeChange(e.target.value, endDate)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        />
        <span className="text-muted-foreground text-xs">~</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onDateRangeChange(startDate, e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Chart mode toggle */}
        <Select
          value={chartMode}
          onChange={(e) => onChartModeChange(e.target.value as "tokens" | "cost")}
          className="h-8 w-24 text-xs"
        >
          <option value="tokens">{t("usage.modes.tokens")}</option>
          <option value="cost">{t("usage.modes.cost")}</option>
        </Select>

        {/* Refresh */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          aria-label={t("usage.actions.refresh")}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>
    </div>
  );
}
