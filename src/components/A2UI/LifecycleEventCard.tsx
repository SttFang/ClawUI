import { Card, CardContent } from "@clawui/ui";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export type OpenClawLifecycleData = {
  runId?: string;
  sessionKey?: string;
  seq?: number;
  ts?: number;
  phase?: string;
  error?: unknown;
};

function phaseColor(phase: string | undefined): string {
  const p = (phase ?? "").toLowerCase();
  if (p === "error") return "bg-destructive/15 text-destructive";
  if (p === "end") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (p === "start") return "bg-blue-500/15 text-blue-700 dark:text-blue-300";
  return "bg-muted text-muted-foreground";
}

export function LifecycleEventCard(props: { data: OpenClawLifecycleData }) {
  const { t } = useTranslation("common");
  const { data } = props;
  const phase = typeof data.phase === "string" ? data.phase : "unknown";
  const ts = typeof data.ts === "number" ? data.ts : null;
  const time = ts ? new Date(ts).toLocaleTimeString() : null;
  const seq = typeof data.seq === "number" ? data.seq : null;

  return (
    <Card className="rounded-xl border border-border/65 bg-card/90 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-[11px]", phaseColor(phase))}>
                {t("a2ui.lifecycle", { phase })}
              </span>
              {seq != null ? (
                <span className="text-xs text-muted-foreground">{t("a2ui.seq", { seq })}</span>
              ) : null}
              {time ? <span className="text-xs text-muted-foreground">{time}</span> : null}
            </div>
            {typeof data.runId === "string" && data.runId.trim() ? (
              <div className="mt-1 truncate text-xs text-muted-foreground">
                {t("a2ui.run", { runId: data.runId })}
              </div>
            ) : null}
          </div>
        </div>

        {data.error ? (
          <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-muted px-3 py-2 text-xs">
            {typeof data.error === "string" ? data.error : JSON.stringify(data.error, null, 2)}
          </pre>
        ) : null}
      </CardContent>
    </Card>
  );
}
