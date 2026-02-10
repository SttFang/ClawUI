import type {
  SessionsUsageEntry,
  UsageTotals,
  UsageAggregates,
  CostDailyEntry,
  UsageTimeSeries,
} from "@clawui/types/usage";
import { create } from "zustand";
import { ipc } from "@/lib/ipc";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

interface UsageState {
  loading: boolean;
  error: string | null;
  startDate: string;
  endDate: string;
  sessions: SessionsUsageEntry[];
  totals: UsageTotals | null;
  aggregates: UsageAggregates | null;
  costDaily: CostDailyEntry[];
  selectedSessionKey: string | null;
  chartMode: "tokens" | "cost";
  timeSeries: UsageTimeSeries | null;
  timeSeriesLoading: boolean;
}

interface UsageActions {
  loadUsage: () => Promise<void>;
  setDateRange: (start: string, end: string) => void;
  selectSession: (key: string | null) => void;
  setChartMode: (mode: "tokens" | "cost") => void;
}

type UsageStore = UsageState & UsageActions;

const initialState: UsageState = {
  loading: false,
  error: null,
  startDate: daysAgoStr(7),
  endDate: todayStr(),
  sessions: [],
  totals: null,
  aggregates: null,
  costDaily: [],
  selectedSessionKey: null,
  chartMode: "tokens",
  timeSeries: null,
  timeSeriesLoading: false,
};

export const useUsageStore = create<UsageStore>((set, get) => ({
  ...initialState,

  loadUsage: async () => {
    const { startDate, endDate } = get();
    set({ loading: true, error: null });
    try {
      const [sessionsResult, costResult] = await Promise.all([
        ipc.usage.sessions({ startDate, endDate }),
        ipc.usage.cost({ startDate, endDate }),
      ]);
      set({
        sessions: sessionsResult.sessions,
        totals: sessionsResult.totals,
        aggregates: sessionsResult.aggregates,
        costDaily: costResult.daily,
        loading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load usage";
      set({ loading: false, error: message });
    }
  },

  setDateRange: (start, end) => {
    set({ startDate: start, endDate: end });
  },

  selectSession: async (key) => {
    set({ selectedSessionKey: key, timeSeries: null });
    if (!key) return;
    const { startDate, endDate } = get();
    set({ timeSeriesLoading: true });
    try {
      const result = await ipc.usage.timeseries({
        key,
        startDate,
        endDate,
      });
      set({ timeSeries: result, timeSeriesLoading: false });
    } catch {
      set({ timeSeriesLoading: false });
    }
  },

  setChartMode: (mode) => set({ chartMode: mode }),
}));

// Selectors — IMPORTANT: only return primitives or stable references.
// Never return a new object literal (e.g. { startDate, endDate }) as Zustand
// uses Object.is and a new object would trigger infinite re-renders.
export const selectUsageLoading = (s: UsageStore) => s.loading;
export const selectUsageError = (s: UsageStore) => s.error;
export const selectStartDate = (s: UsageStore) => s.startDate;
export const selectEndDate = (s: UsageStore) => s.endDate;
export const selectSessions = (s: UsageStore) => s.sessions;
export const selectTotals = (s: UsageStore) => s.totals;
export const selectAggregates = (s: UsageStore) => s.aggregates;
export const selectCostDaily = (s: UsageStore) => s.costDaily;
export const selectSelectedSessionKey = (s: UsageStore) => s.selectedSessionKey;
export const selectChartMode = (s: UsageStore) => s.chartMode;
export const selectTimeSeries = (s: UsageStore) => s.timeSeries;
export const selectTimeSeriesLoading = (s: UsageStore) => s.timeSeriesLoading;
