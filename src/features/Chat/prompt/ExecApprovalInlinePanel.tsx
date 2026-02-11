import { Card, CardContent } from "@clawui/ui";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  getPendingApprovalsForSession,
  useExecApprovalsStore,
  type ExecApprovalDecision,
} from "@/store/execApprovals";

/** Extract the first line (up to 50 chars) as a command prefix hint. */
function commandPrefix(command: string): string {
  const first = command.trimStart().split("\n")[0];
  return first.length > 50 ? `${first.slice(0, 50)}…` : first;
}

export function useHasPendingExecApproval(sessionKey: string): boolean {
  const queue = useExecApprovalsStore((s) => s.queue);
  const normalizedSessionKey = sessionKey.trim();
  return useMemo(
    () => getPendingApprovalsForSession(queue, normalizedSessionKey).length > 0,
    [queue, normalizedSessionKey],
  );
}

const DECISIONS: ExecApprovalDecision[] = ["allow-once", "allow-always", "deny"];

export function ExecApprovalInlinePanel(props: { sessionKey: string; className?: string }) {
  const { t } = useTranslation("common");
  const { sessionKey, className } = props;
  const normalizedSessionKey = sessionKey.trim();
  const queue = useExecApprovalsStore((s) => s.queue);
  const pendingForSession = useMemo(
    () => getPendingApprovalsForSession(queue, normalizedSessionKey),
    [queue, normalizedSessionKey],
  );
  const current = pendingForSession[0] ?? null;
  const busyById = useExecApprovalsStore((s) => s.busyById);
  const lastResolved = useExecApprovalsStore((s) => s.lastResolvedBySession[normalizedSessionKey]);
  const resolve = useExecApprovalsStore((s) => s.resolve);
  const busy = current ? busyById[current.id] === true : false;
  const pendingCount = pendingForSession.length;
  const remainingCount = Math.max(0, pendingCount - 1);
  const shortId = current ? current.id.slice(-8) : "";
  const resolvedShortId = lastResolved?.id.slice(-8) ?? "";

  const onDecision = async (decision: ExecApprovalDecision) => {
    if (!current || busy) return;
    try {
      await resolve(current.id, decision);
    } catch {
      // keep pending entry for retry
    }
  };

  if (!current) return null;

  const meta = [current.request.agentId, current.request.cwd].filter(Boolean).join(" · ");
  const prefix = commandPrefix(current.request.command);

  return (
    <Card
      className={cn(
        "mb-2 overflow-hidden border-primary/30 bg-card/95 shadow-md backdrop-blur-sm",
        className,
      )}
    >
      <CardContent className="space-y-2 p-3">
        {/* Title */}
        <div className="text-sm font-medium">
          {t("execApproval.needsApproval", {
            title: current.request.host
              ? t("execApproval.titleWithHost", { host: current.request.host })
              : t("execApproval.title"),
          })}
        </div>

        {/* Intent summary (ask field) */}
        {current.request.ask && (
          <div className="text-xs text-muted-foreground">{current.request.ask}</div>
        )}

        {lastResolved ? (
          <div className="text-xs text-muted-foreground">
            {t("execApproval.description", { id: resolvedShortId || lastResolved.id })}
          </div>
        ) : null}

        {/* Security warning */}
        {current.request.security && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-900 dark:text-amber-200">
            {current.request.security}
          </div>
        )}

        {/* Compact metadata */}
        <div className="text-xs text-muted-foreground">
          {meta ? `${meta} · ` : ""}
          {t("execApproval.description", { id: shortId || current.id })}
        </div>
        {remainingCount > 0 ? (
          <div className="text-xs text-muted-foreground">+ {remainingCount} pending approvals</div>
        ) : null}

        {/* Command code block */}
        <pre className="max-h-28 overflow-auto rounded-md bg-muted px-2 py-1.5 text-xs leading-tight">
          {current.request.command}
        </pre>

        {/* Option list */}
        <div className="space-y-1">
          {DECISIONS.map((decision, i) => (
            <button
              key={decision}
              type="button"
              disabled={busy}
              onClick={() => void onDecision(decision)}
              className={cn(
                "flex w-full items-start gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                "text-muted-foreground",
              )}
            >
              <span className="shrink-0 font-medium">{i + 1}.</span>
              <div className="min-w-0">
                <div>
                  {t(
                    `execApproval.actions.${decision === "allow-once" ? "allowOnce" : decision === "allow-always" ? "allowAlways" : "deny"}`,
                  )}
                </div>
                {decision === "allow-always" && (
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {t("execApproval.actions.allowAlwaysHint", { prefix })}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
