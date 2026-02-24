import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  getPendingApprovalsForSession,
  useExecApprovalsStore,
  type ExecApprovalDecision,
} from "@/store/exec";

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
  const resolve = useExecApprovalsStore((s) => s.resolve);
  const busy = current ? busyById[current.id] === true : false;
  const cmdPreview = current ? commandPrefix(current.request.command) : "";

  const onDecision = async (decision: ExecApprovalDecision) => {
    if (!current || busy) return;
    try {
      await resolve(current.id, decision);
    } catch {
      // keep pending entry for retry
    }
  };

  if (!current) return null;

  return (
    <div className={cn("space-y-2 px-4 py-3", className)}>
      {/* Title + inline command */}
      <div className="flex items-baseline gap-1.5 text-sm">
        <span className="shrink-0 font-medium">{t("execApproval.needsApproval")}</span>
        <code className="min-w-0 truncate rounded bg-muted px-1.5 py-0.5 text-xs">
          {cmdPreview}
        </code>
        {current.request.host === "node" && current.request.nodeId && (
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            @ {current.request.nodeId}
          </span>
        )}
      </div>

      {/* Decision buttons */}
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
            <div>
              {t(
                `execApproval.actions.${decision === "allow-once" ? "allowOnce" : decision === "allow-always" ? "allowAlways" : "deny"}`,
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
