import { Alert, AlertDescription } from "@clawui/ui";
import { Loader2 } from "lucide-react";
import { useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { CostBreakdown } from "@/components/Usage/CostBreakdown";
import { DailySignalsTable } from "@/components/Usage/DailySignalsTable";
import { DailyTrendChart } from "@/components/Usage/DailyTrendChart";
import { ProviderBreakdown } from "@/components/Usage/ProviderBreakdown";
import { SessionDetail } from "@/components/Usage/SessionDetail";
import { SessionList } from "@/components/Usage/SessionList";
import { SessionTimeline } from "@/components/Usage/SessionTimeline";
import { UsageHeader } from "@/components/Usage/UsageHeader";
import {
  useUsageStore,
  selectUsageLoading,
  selectUsageError,
  selectSessions,
  selectTotals,
  selectAggregates,
  selectCostDaily,
  selectStartDate,
  selectEndDate,
  selectSelectedSessionKey,
  selectChartMode,
  selectTimeSeries,
  selectTimeSeriesLoading,
} from "@/store/usage";

export default function UsagePage() {
  const { t } = useTranslation("common");
  const loading = useUsageStore(selectUsageLoading);
  const error = useUsageStore(selectUsageError);
  const sessions = useUsageStore(selectSessions);
  const totals = useUsageStore(selectTotals);
  const aggregates = useUsageStore(selectAggregates);
  const costDaily = useUsageStore(selectCostDaily);
  // Use individual primitive selectors to avoid Object.is re-render loops
  const startDate = useUsageStore(selectStartDate);
  const endDate = useUsageStore(selectEndDate);
  const selectedSessionKey = useUsageStore(selectSelectedSessionKey);
  const chartMode = useUsageStore(selectChartMode);
  const timeSeries = useUsageStore(selectTimeSeries);
  const timeSeriesLoading = useUsageStore(selectTimeSeriesLoading);

  const loadUsage = useUsageStore((s) => s.loadUsage);
  const setDateRange = useUsageStore((s) => s.setDateRange);
  const doSelectSession = useUsageStore((s) => s.selectSession);
  const setChartMode = useUsageStore((s) => s.setChartMode);

  // Stable callback that reads date range from store via get()
  const handleLoad = useCallback(() => {
    loadUsage();
  }, [loadUsage]);

  // Load on mount and when date range changes
  useEffect(() => {
    handleLoad();
  }, [handleLoad, startDate, endDate]);

  const selectedSession = sessions.find((s) => s.key === selectedSessionKey);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-semibold">{t("usage.title")}</h1>
          <p className="text-muted-foreground">{t("usage.description")}</p>
        </div>

        {/* Header: date range + mode + refresh */}
        <UsageHeader
          startDate={startDate}
          endDate={endDate}
          chartMode={chartMode}
          loading={loading}
          onDateRangeChange={setDateRange}
          onChartModeChange={setChartMode}
          onRefresh={handleLoad}
        />

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading overlay for initial load */}
        {loading && !totals ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Daily Trend (with integrated summary stats) */}
            {costDaily.length > 0 && (
              <DailyTrendChart
                data={costDaily}
                mode={chartMode}
                totals={totals}
                aggregates={aggregates}
                sessionCount={sessions.length}
              />
            )}

            {/* Compact daily signal table (tokens/cost/messages/tool calls/errors) */}
            {aggregates?.daily?.length ? <DailySignalsTable daily={aggregates.daily} /> : null}

            {/* Cost Breakdown + Provider Distribution */}
            <div className="grid gap-4 md:grid-cols-2">
              <CostBreakdown totals={totals} />
              <ProviderBreakdown byProvider={aggregates?.byProvider ?? []} />
            </div>

            {/* Session List */}
            <SessionList
              sessions={sessions}
              selectedKey={selectedSessionKey}
              onSelect={doSelectSession}
            />

            {/* Session Detail + Timeline (shown when session selected) */}
            {selectedSessionKey && (
              <div className="space-y-4">
                <SessionDetail session={selectedSession} />
                <SessionTimeline
                  timeSeries={timeSeries}
                  loading={timeSeriesLoading}
                  mode={chartMode}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
