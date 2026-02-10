import type { DynamicToolUIPart } from 'ai'
import { Card, CardContent } from '@clawui/ui'
import { cn } from '@/lib/utils'

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function StatePill(props: { state: string; preliminary?: boolean }) {
  const { state, preliminary } = props
  return (
    <div
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-[11px]',
        'bg-muted text-muted-foreground',
        preliminary && 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200'
      )}
    >
      {preliminary ? `${state} (partial)` : state}
    </div>
  )
}

export function ToolEventCard(props: { part: DynamicToolUIPart }) {
  const { part } = props

  const title = part.title?.trim() ? part.title : part.toolName
  const state = part.state

  return (
    <Card className="rounded-xl">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{title}</div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {part.toolName} · {part.toolCallId}
            </div>
          </div>
          <StatePill state={state} preliminary={state === 'output-available' ? (part as unknown as { preliminary?: boolean }).preliminary : false} />
        </div>

        {state === 'input-available' || state === 'input-streaming' ? (
          <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-muted px-3 py-2 text-xs">
            {formatJson(part.input)}
          </pre>
        ) : null}

        {state === 'output-available' ? (
          <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-muted px-3 py-2 text-xs">
            {formatJson(part.output)}
          </pre>
        ) : null}

        {state === 'output-error' ? (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {part.errorText}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

