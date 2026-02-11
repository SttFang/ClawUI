import { Button, Card, CardContent } from "@clawui/ui";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useExecApprovalsStore, type ExecApprovalDecision } from "@/store/execApprovals";

type ApprovalEntry = ReturnType<typeof useExecApprovalsStore.getState>["queue"][number];

function pickApprovalForSession(queue: ApprovalEntry[], sessionKey: string): ApprovalEntry | null {
  if (queue.length === 0) return null;
  const normalized = sessionKey.trim();
  if (!normalized) return queue[0] ?? null;
  return queue.find((entry) => entry.request.sessionKey === normalized) ?? queue[0] ?? null;
}

function formatLine(label: string, value: string | null | undefined) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-xs">
      <div className="w-16 shrink-0 text-muted-foreground">{label}</div>
      <div className="min-w-0 flex-1 break-words">{value}</div>
    </div>
  );
}

export function useHasPendingExecApproval(sessionKey: string): boolean {
  const queue = useExecApprovalsStore((s) => s.queue);
  const current = useMemo(() => pickApprovalForSession(queue, sessionKey), [queue, sessionKey]);
  return Boolean(current);
}

export function ExecApprovalInlinePanel(props: { sessionKey: string; className?: string }) {
  const { t } = useTranslation("common");
  const { sessionKey, className } = props;
  const queue = useExecApprovalsStore((s) => s.queue);
  const busyById = useExecApprovalsStore((s) => s.busyById);
  const resolve = useExecApprovalsStore((s) => s.resolve);
  const remove = useExecApprovalsStore((s) => s.remove);

  const current = useMemo(() => pickApprovalForSession(queue, sessionKey), [queue, sessionKey]);
  const busy = current ? busyById[current.id] === true : false;

  const onDecision = async (decision: ExecApprovalDecision) => {
    if (!current || busy) return;
    try {
      await resolve(current.id, decision);
      remove(current.id);
    } catch {
      // keep pending entry for retry
    }
  };

  if (!current) return null;

  return (
    <Card
      className={cn(
        "mb-2 overflow-hidden border-primary/30 bg-card/95 shadow-md backdrop-blur-sm",
        className,
      )}
    >
      <CardContent className="space-y-3 p-3">
        <div>
          <div className="text-sm font-medium">
            {t("execApproval.needsApproval", {
              title: current.request.host
                ? t("execApproval.titleWithHost", { host: current.request.host })
                : t("execApproval.title"),
            })}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {t("execApproval.description", { id: current.id })}
          </div>
        </div>

        <div className="space-y-1.5">
          {formatLine(t("execApproval.fields.agent"), current.request.agentId)}
          {formatLine(t("execApproval.fields.session"), current.request.sessionKey)}
          {formatLine(t("execApproval.fields.cwd"), current.request.cwd)}
        </div>

        <pre className="max-h-28 overflow-auto rounded-md bg-muted px-2.5 py-2 text-xs">
          {current.request.command}
        </pre>

        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void onDecision("allow-once")}
            className="justify-start"
          >
            {t("execApproval.actions.allowOnce")}
          </Button>
          <Button
            disabled={busy}
            onClick={() => void onDecision("allow-always")}
            className="justify-start"
          >
            {t("execApproval.actions.allowAlways")}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void onDecision("deny")}
            className="justify-start border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            {t("execApproval.actions.deny")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
