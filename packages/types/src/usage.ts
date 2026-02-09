// Usage & Cost Types
// Mapped from OpenClaw ACP API: sessions.usage, usage.cost, sessions.usage.timeseries

export type UsageTotals = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  totalCost: number
  inputCost: number
  outputCost: number
  cacheReadCost: number
  cacheWriteCost: number
  missingCostEntries: number
}

export type CostDailyEntry = UsageTotals & { date: string }

export type CostUsageSummary = {
  updatedAt: number
  days: number
  daily: CostDailyEntry[]
  totals: UsageTotals
}

export type SessionMessageCounts = {
  total: number
  user: number
  assistant: number
  toolCalls: number
  toolResults: number
  errors: number
}

export type SessionToolUsage = {
  totalCalls: number
  uniqueTools: number
  tools: Array<{ name: string; count: number }>
}

export type SessionModelUsage = {
  provider?: string
  model?: string
  count: number
  totals: UsageTotals
}

export type SessionLatencyStats = {
  count: number
  avgMs: number
  p95Ms: number
  minMs: number
  maxMs: number
}

export type SessionCostSummary = UsageTotals & {
  firstActivity?: number
  lastActivity?: number
  durationMs?: number
  activityDates?: string[]
  dailyBreakdown?: Array<{ date: string; tokens: number; cost: number }>
  messageCounts?: SessionMessageCounts
  toolUsage?: SessionToolUsage
  modelUsage?: SessionModelUsage[]
  latency?: SessionLatencyStats
}

export type SessionsUsageEntry = {
  key: string
  label?: string
  sessionId?: string
  updatedAt?: number
  agentId?: string
  channel?: string
  chatType?: string
  modelProvider?: string
  model?: string
  usage: SessionCostSummary | null
}

export type UsageAggregates = {
  messages: SessionMessageCounts
  tools: SessionToolUsage
  byModel: SessionModelUsage[]
  byProvider: SessionModelUsage[]
  daily: Array<{
    date: string
    tokens: number
    cost: number
    messages: number
    toolCalls: number
    errors: number
  }>
  latency?: SessionLatencyStats
}

export type SessionsUsageResult = {
  updatedAt: number
  startDate: string
  endDate: string
  sessions: SessionsUsageEntry[]
  totals: UsageTotals
  aggregates: UsageAggregates
}

export type UsageTimeSeriesPoint = {
  timestamp: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  cost: number
  cumulativeTokens: number
  cumulativeCost: number
}

export type UsageTimeSeries = {
  points: UsageTimeSeriesPoint[]
}
