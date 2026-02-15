import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@clawui/ui";
import { CheckCircle2, ChevronRight, Loader2, SkipForward, Timer, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import type { GatewayActivityEntry } from "@/store/gatewayActivity";
import { useGatewayActivityStore, selectCronEntries } from "@/store/gatewayActivity";

const MAX_VISIBLE = 10;

function formatTime(ts: number): string {
  const d = new Date(ts);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

type CronPayload = {
  jobId?: string;
  action?: string;
  status?: string;
  summary?: string;
  error?: string;
  durationMs?: number;
};

function StatusIcon({ action, status }: { action: string; status?: string }) {
  if (action === "started") {
    return <Loader2 className="size-3.5 shrink-0 animate-spin text-amber-500" />;
  }
  if (action === "finished") {
    if (status === "ok") return <CheckCircle2 className="size-3.5 shrink-0 text-green-500" />;
    if (status === "error") return <XCircle className="size-3.5 shrink-0 text-red-500" />;
    if (status === "skipped")
      return <SkipForward className="size-3.5 shrink-0 text-muted-foreground" />;
  }
  return <Timer className="size-3.5 shrink-0 text-muted-foreground" />;
}

function CronEntry({ entry }: { entry: GatewayActivityEntry }) {
  const { t } = useTranslation("common");
  const p = (entry.payload ?? {}) as CronPayload;
  const action = p.action ?? "";
  const status = p.status;
  const jobId = p.jobId ? p.jobId.slice(0, 8) : "—";

  let detail: string;
  if (action === "started") {
    detail = t("cronResults.running");
  } else if (action === "finished" && status === "ok") {
    const label = p.summary || t("cronResults.completed");
    const dur = typeof p.durationMs === "number" ? ` ${(p.durationMs / 1000).toFixed(1)}s` : "";
    detail = label + dur;
  } else if (action === "finished" && status === "error") {
    detail = p.error || t("cronResults.failed");
  } else if (action === "finished" && status === "skipped") {
    detail = p.error || t("cronResults.skipped");
  } else {
    detail = action;
  }

  return (
    <div className="flex gap-2 py-1 text-xs">
      <span className="shrink-0 tabular-nums text-muted-foreground">{formatTime(entry.ts)}</span>
      <StatusIcon action={action} status={status} />
      <div className="min-w-0">
        <div className="truncate font-medium">{jobId}</div>
        <div className="truncate text-muted-foreground">{detail}</div>
      </div>
    </div>
  );
}

export function CronResultList() {
  const { t } = useTranslation("common");
  const cronEntries = useGatewayActivityStore(useShallow(selectCronEntries));

  if (cronEntries.length === 0) return null;

  const visible = cronEntries.slice(-MAX_VISIBLE).toReversed();

  return (
    <Collapsible defaultOpen className="border-t">
      <div className="flex w-full items-center gap-1 px-4 py-2 text-xs font-medium text-muted-foreground">
        <CollapsibleTrigger className="flex flex-1 items-center gap-1 hover:text-foreground">
          <ChevronRight className="h-3 w-3 transition-transform [[data-state=open]>&]:rotate-90" />
          <span className="flex-1 text-left">{t("cronResults.title")}</span>
        </CollapsibleTrigger>
        <span className="tabular-nums text-[10px]">({cronEntries.length})</span>
      </div>
      <CollapsibleContent>
        <div className="px-2 pb-2 space-y-0.5">
          {visible.map((entry: GatewayActivityEntry) => (
            <CronEntry key={entry.id} entry={entry} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
