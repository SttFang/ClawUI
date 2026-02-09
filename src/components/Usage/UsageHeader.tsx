import { Button, Select } from '@clawui/ui'
import { RefreshCw } from 'lucide-react'

interface UsageHeaderProps {
  startDate: string
  endDate: string
  chartMode: 'tokens' | 'cost'
  loading: boolean
  onDateRangeChange: (start: string, end: string) => void
  onChartModeChange: (mode: 'tokens' | 'cost') => void
  onRefresh: () => void
}

function daysAgoStr(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

const presets = [
  { label: 'Today', days: 0 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
]

export function UsageHeader({
  startDate,
  endDate,
  chartMode,
  loading,
  onDateRangeChange,
  onChartModeChange,
  onRefresh,
}: UsageHeaderProps) {
  const today = todayStr()

  const activePreset = presets.find(
    (p) =>
      endDate === today &&
      startDate === (p.days === 0 ? today : daysAgoStr(p.days))
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Date presets */}
      <div className="flex gap-1">
        {presets.map((p) => (
          <Button
            key={p.label}
            variant={activePreset?.days === p.days ? 'default' : 'outline'}
            size="sm"
            onClick={() =>
              onDateRangeChange(
                p.days === 0 ? today : daysAgoStr(p.days),
                today
              )
            }
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
          onChange={(e) =>
            onChartModeChange(e.target.value as 'tokens' | 'cost')
          }
          className="h-8 w-24 text-xs"
        >
          <option value="tokens">Tokens</option>
          <option value="cost">Cost</option>
        </Select>

        {/* Refresh */}
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>
    </div>
  )
}
