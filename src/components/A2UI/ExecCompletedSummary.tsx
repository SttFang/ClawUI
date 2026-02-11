import { ChainOfAction, ChainOfActionContent, ChainOfActionTrigger } from "@clawui/ui";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ExecTrace } from "./execTrace";

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatSeconds(ms: number): number {
  return Math.max(0, Math.round(ms / 1000));
}

export function ExecCompletedSummary(props: { traces: ExecTrace[] }) {
  const { t } = useTranslation("common");
  const { traces } = props;
  const [expanded, setExpanded] = useState(false);

  const totalMs = useMemo(
    () =>
      traces.reduce((sum, trace) => {
        return sum + (trace.durationMs ?? 0);
      }, 0),
    [traces],
  );
  const singleMs = totalMs > 0 ? totalMs : (traces[0]?.durationMs ?? 0);

  const title =
    traces.length > 1
      ? t("a2ui.execAction.completedMulti", {
          count: traces.length,
          seconds: formatSeconds(totalMs),
        })
      : t("a2ui.execAction.completedSingle", {
          seconds: formatSeconds(singleMs),
        });

  return (
    <ChainOfAction className="overflow-hidden border-dashed">
      <ChainOfActionTrigger
        title={title}
        subtitle={expanded ? t("a2ui.execAction.hideTrace") : t("a2ui.execAction.showTrace")}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
      />
      <ChainOfActionContent open={expanded} className="space-y-3">
        {traces.map((trace) => (
          <div key={trace.traceKey} className="rounded-md border bg-muted/50 px-3 py-2">
            <div className="text-xs font-medium">{trace.command}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {t("a2ui.execAction.duration", {
                seconds: formatSeconds(trace.durationMs ?? 0),
              })}
            </div>
            {trace.output !== undefined ? (
              <pre className="mt-2 max-h-56 overflow-auto rounded bg-muted px-2 py-1.5 text-xs">
                {formatJson(trace.output)}
              </pre>
            ) : trace.errorText ? (
              <div className="mt-2 rounded border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                {trace.errorText}
              </div>
            ) : (
              <div className="mt-2 text-xs text-muted-foreground">
                {t("a2ui.execAction.noOutput")}
              </div>
            )}
          </div>
        ))}
      </ChainOfActionContent>
    </ChainOfAction>
  );
}
