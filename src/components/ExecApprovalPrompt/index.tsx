import { useMemo } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@clawui/ui'
import { useTranslation } from 'react-i18next'
import { useExecApprovalsStore, type ExecApprovalDecision } from '@/store/execApprovals'
import { cn } from '@/lib/utils'

function formatLine(label: string, value: string | null | undefined) {
  if (!value) return null
  return (
    <div className="flex gap-2 text-xs">
      <div className="w-20 shrink-0 text-muted-foreground">{label}</div>
      <div className="min-w-0 flex-1 break-words">{value}</div>
    </div>
  )
}

export function ExecApprovalPrompt() {
  const { t } = useTranslation('common')
  const queue = useExecApprovalsStore((s) => s.queue)
  const busyById = useExecApprovalsStore((s) => s.busyById)
  const resolve = useExecApprovalsStore((s) => s.resolve)
  const remove = useExecApprovalsStore((s) => s.remove)

  const current = queue[0] ?? null
  const busy = current ? busyById[current.id] === true : false

  const title = useMemo(() => {
    if (!current) return ''
    return current.request.host
      ? t('execApproval.titleWithHost', { host: current.request.host })
      : t('execApproval.title')
  }, [current, t])

  const onDecision = async (decision: ExecApprovalDecision) => {
    if (!current || busy) return
    try {
      await resolve(current.id, decision)
      remove(current.id)
    } catch {
      // Keep it in queue; errors are handled elsewhere.
    }
  }

  if (!current) return null

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl" onClose={() => remove(current.id)}>
        <DialogHeader>
          <DialogTitle>{t('execApproval.needsApproval', { title })}</DialogTitle>
          <DialogDescription>
            {t('execApproval.description', { id: current.id })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 p-6 pt-4">
          {formatLine(t('execApproval.fields.agent'), current.request.agentId)}
          {formatLine(t('execApproval.fields.session'), current.request.sessionKey)}
          {formatLine(t('execApproval.fields.cwd'), current.request.cwd)}
          {formatLine(t('execApproval.fields.path'), current.request.resolvedPath)}

          {current.request.security ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              {current.request.security}
            </div>
          ) : null}

          {current.request.ask ? (
            <div className="rounded-lg border bg-muted px-3 py-2 text-xs">
              {current.request.ask}
            </div>
          ) : null}

          <pre className="max-h-64 overflow-auto rounded-lg bg-muted px-3 py-2 text-xs">
            {current.request.command}
          </pre>
        </div>

        <DialogFooter className="flex-wrap">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void onDecision('deny')}
            className={cn('border-destructive/40 text-destructive hover:bg-destructive/10')}
          >
            {t('execApproval.actions.deny')}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void onDecision('allow-once')}>
            {t('execApproval.actions.allowOnce')}
          </Button>
          <Button disabled={busy} onClick={() => void onDecision('allow-always')}>
            {t('execApproval.actions.allowAlways')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
