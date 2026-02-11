import { Task, TaskContent, TaskItem, TaskItemFile, TaskTrigger } from "@clawui/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ExecTrace } from "./execTrace";
import { formatSecondsFromMs, outputToText, summarizeOutputText } from "./execDisplay";

export function ExecCompletedSummary(props: { traces: ExecTrace[] }) {
  const { t } = useTranslation("common");
  const { traces } = props;
  const [expanded, setExpanded] = useState(true);
  const [expandedTraceKeys, setExpandedTraceKeys] = useState<Record<string, boolean>>({});
  const userToggledRef = useRef(false);

  const totalMs = useMemo(
    () =>
      traces.reduce((sum, trace) => {
        return sum + (trace.durationMs ?? 0);
      }, 0),
    [traces],
  );
  const singleMs = totalMs > 0 ? totalMs : (traces[0]?.durationMs ?? 0);
  const hasError = traces.some((trace) => trace.status === "error");
  const statusLabel = hasError ? t("a2ui.execAction.statusError") : t("a2ui.execAction.statusDone");
  const traceSignature = traces
    .map((trace) => `${trace.traceKey}:${trace.status}:${trace.durationMs ?? 0}`)
    .join("|");

  const title =
    traces.length > 1
      ? t("a2ui.execAction.completedMulti", {
          count: traces.length,
          seconds: formatSecondsFromMs(totalMs),
        })
      : t("a2ui.execAction.completedSingle", {
          seconds: formatSecondsFromMs(singleMs),
        });

  useEffect(() => {
    if (userToggledRef.current) return;
    setExpanded(true);
    const timer = window.setTimeout(() => {
      if (!userToggledRef.current) {
        setExpanded(false);
      }
    }, 1200);
    return () => {
      window.clearTimeout(timer);
    };
  }, [traceSignature]);

  const toggleTraceOutput = (traceKey: string) => {
    setExpandedTraceKeys((prev) => ({ ...prev, [traceKey]: !prev[traceKey] }));
  };

  const onToggle = () => {
    userToggledRef.current = true;
    setExpanded((prev) => !prev);
  };

  return (
    <Task open={expanded} onOpenChange={onToggle}>
      <TaskTrigger title={title} />
      <TaskContent>
        <TaskItem className="text-xs">
          {statusLabel} ·{" "}
          {t("a2ui.execAction.duration", {
            seconds: formatSecondsFromMs(totalMs > 0 ? totalMs : singleMs),
          })}
        </TaskItem>
        {traces.map((trace) => {
          const isError = trace.status === "error";
          const outputText = outputToText(trace.output);
          const { preview, truncated } = summarizeOutputText(outputText);
          const expandedOutput = expandedTraceKeys[trace.traceKey] === true;
          const canExpandOutput = truncated || outputText.length > preview.length;
          const displayOutput = expandedOutput ? outputText : preview;

          return (
            <div
              key={trace.traceKey}
              className="space-y-2 rounded-md border border-border/70 px-3 py-2"
            >
              <TaskItem className="inline-flex items-center gap-2">
                <TaskItemFile>{trace.command || t("a2ui.execAction.noCommand")}</TaskItemFile>
                <span className="text-xs text-muted-foreground">
                  {t("a2ui.execAction.duration", {
                    seconds: formatSecondsFromMs(trace.durationMs),
                  })}
                </span>
              </TaskItem>
              {trace.output !== undefined ? (
                <div className="space-y-2">
                  <div className="text-[11px] text-muted-foreground">
                    {t("a2ui.execAction.outputSummary")}
                  </div>
                  <pre className="max-h-56 overflow-auto rounded bg-muted px-2 py-1.5 text-xs">
                    {displayOutput || t("a2ui.execAction.noOutput")}
                  </pre>
                  {canExpandOutput ? (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => toggleTraceOutput(trace.traceKey)}
                    >
                      {expandedOutput
                        ? t("a2ui.execAction.hideFullOutput")
                        : t("a2ui.execAction.viewFullOutput")}
                    </button>
                  ) : null}
                </div>
              ) : trace.errorText ? (
                <div className="rounded border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                  {trace.errorText}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">{t("a2ui.execAction.noOutput")}</div>
              )}
              {isError ? (
                <TaskItem className="text-xs text-destructive">
                  {t("a2ui.execAction.statusError")}
                </TaskItem>
              ) : null}
            </div>
          );
        })}
      </TaskContent>
    </Task>
  );
}
