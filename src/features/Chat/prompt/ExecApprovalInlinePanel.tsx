import { Button, Card, CardContent } from "@clawui/ui";
import { useMemo, useState } from "react";
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

/** Extract the first line (up to 50 chars) as a command prefix hint. */
function commandPrefix(command: string): string {
  const first = command.trimStart().split("\n")[0];
  return first.length > 50 ? `${first.slice(0, 50)}…` : first;
}

export function useHasPendingExecApproval(sessionKey: string): boolean {
  const queue = useExecApprovalsStore((s) => s.queue);
  const current = useMemo(() => pickApprovalForSession(queue, sessionKey), [queue, sessionKey]);
  return Boolean(current);
}

const DECISIONS: ExecApprovalDecision[] = ["allow-once", "allow-always", "deny"];

export function ExecApprovalInlinePanel(props: { sessionKey: string; className?: string }) {
  const { t } = useTranslation("common");
  const { sessionKey, className } = props;
  const queue = useExecApprovalsStore((s) => s.queue);
  const busyById = useExecApprovalsStore((s) => s.busyById);
  const resolve = useExecApprovalsStore((s) => s.resolve);
  const remove = useExecApprovalsStore((s) => s.remove);

  const current = useMemo(() => pickApprovalForSession(queue, sessionKey), [queue, sessionKey]);
  const busy = current ? busyById[current.id] === true : false;
  const [selected, setSelected] = useState<ExecApprovalDecision>("allow-once");

  const onSubmit = async () => {
    if (!current || busy) return;
    try {
      await resolve(current.id, selected);
      remove(current.id);
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

        {/* Security warning */}
        {current.request.security && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-900 dark:text-amber-200">
            {current.request.security}
          </div>
        )}

        {/* Compact metadata */}
        {meta && <div className="text-xs text-muted-foreground">{meta}</div>}

        {/* Command code block */}
        <pre className="max-h-28 overflow-auto rounded-md bg-muted px-2 py-1.5 text-xs leading-tight">
          {current.request.command}
        </pre>

        {/* Radio list */}
        <div className="space-y-1">
          {DECISIONS.map((decision, i) => (
            <button
              key={decision}
              type="button"
              disabled={busy}
              onClick={() => setSelected(decision)}
              className={cn(
                "flex w-full items-start gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                selected === decision
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <span className="shrink-0 font-medium">{i + 1}.</span>
              <div className="min-w-0">
                <div className={cn(selected === decision && "font-medium")}>
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

        {/* Submit */}
        <div className="flex justify-end">
          <Button size="sm" disabled={busy} onClick={() => void onSubmit()}>
            {t("execApproval.actions.submit")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
