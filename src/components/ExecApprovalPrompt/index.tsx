import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@clawui/ui";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useExecApprovalsStore, type ExecApprovalDecision } from "@/store/exec";

/** Extract the first line (up to 50 chars) as a command prefix hint. */
function commandPrefix(command: string): string {
  const first = command.trimStart().split("\n")[0];
  return first.length > 50 ? `${first.slice(0, 50)}…` : first;
}

const DECISIONS: ExecApprovalDecision[] = ["allow-once", "allow-always", "deny"];

export function ExecApprovalPrompt() {
  const { t } = useTranslation("common");
  const queue = useExecApprovalsStore((s) => s.queue);
  const busyById = useExecApprovalsStore((s) => s.busyById);
  const resolve = useExecApprovalsStore((s) => s.resolve);
  const remove = useExecApprovalsStore((s) => s.remove);

  const current = queue[0] ?? null;
  const busy = current ? busyById[current.id] === true : false;

  const title = useMemo(() => {
    if (!current) return "";
    return current.request.host
      ? t("execApproval.titleWithHost", { host: current.request.host })
      : t("execApproval.title");
  }, [current, t]);

  const onDecision = async (decision: ExecApprovalDecision) => {
    if (!current || busy) return;
    try {
      await resolve(current.id, decision);
      remove(current.id);
    } catch {
      // Keep it in queue; errors are handled elsewhere.
    }
  };

  if (!current) return null;

  const meta = [current.request.agentId, current.request.cwd].filter(Boolean).join(" · ");
  const prefix = commandPrefix(current.request.command);

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl" onClose={() => remove(current.id)}>
        <DialogHeader>
          <DialogTitle>{t("execApproval.needsApproval", { title })}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 px-6 pb-2">
          {/* Intent summary */}
          {current.request.ask && (
            <div className="text-xs text-muted-foreground">{current.request.ask}</div>
          )}

          {/* Security warning */}
          {current.request.security && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-900 dark:text-amber-200">
              {current.request.security}
            </div>
          )}

          {/* Compact metadata */}
          {meta && <div className="text-xs text-muted-foreground">{meta}</div>}

          {/* Command code block */}
          <pre className="max-h-64 overflow-auto rounded-md bg-muted px-2 py-1.5 text-xs leading-tight">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
