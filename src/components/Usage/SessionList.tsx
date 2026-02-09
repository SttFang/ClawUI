import { Card, CardContent, CardHeader, CardTitle, Select } from '@clawui/ui'
import { ScrollArea } from '@clawui/ui'
import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { SessionsUsageEntry } from '@clawui/types/usage'

interface SessionListProps {
  sessions: SessionsUsageEntry[]
  selectedKey: string | null
  onSelect: (key: string | null) => void
}

type SortField = 'cost' | 'tokens' | 'key'

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`
}

export function SessionList({ sessions, selectedKey, onSelect }: SessionListProps) {
  const [sortBy, setSortBy] = useState<SortField>('cost')

  const sorted = [...sessions].sort((a, b) => {
    if (sortBy === 'cost')
      return (b.usage?.totalCost ?? 0) - (a.usage?.totalCost ?? 0)
    if (sortBy === 'tokens')
      return (b.usage?.totalTokens ?? 0) - (a.usage?.totalTokens ?? 0)
    return a.key.localeCompare(b.key)
  })

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Sessions</CardTitle>
        <Select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortField)}
          className="h-8 w-28 text-xs"
        >
          <option value="cost">Sort: Cost</option>
          <option value="tokens">Sort: Tokens</option>
          <option value="key">Sort: Name</option>
        </Select>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-72">
          <div className="divide-y">
            {sorted.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                No sessions found
              </p>
            ) : (
              sorted.map((s) => (
                <button
                  key={s.key}
                  onClick={() =>
                    onSelect(selectedKey === s.key ? null : s.key)
                  }
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/50 ${
                    selectedKey === s.key ? 'bg-muted' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.label ?? s.key}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.modelProvider ?? '-'} / {s.model ?? '-'}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                    <p>{formatTokens(s.usage?.totalTokens ?? 0)}</p>
                    <p>{formatCost(s.usage?.totalCost ?? 0)}</p>
                  </div>
                  <ChevronRight
                    size={14}
                    className={`shrink-0 text-muted-foreground transition-transform ${
                      selectedKey === s.key ? 'rotate-90' : ''
                    }`}
                  />
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
