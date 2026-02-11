import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "../utils";

export type ChainOfActionStatus = "idle" | "waiting_approval" | "running" | "completed" | "error";

const STATUS_STYLES: Record<ChainOfActionStatus, string> = {
  idle: "border-border bg-muted/40 text-muted-foreground",
  waiting_approval:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200",
  running:
    "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200",
  completed:
    "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function ChainOfAction(props: React.ComponentPropsWithoutRef<"div">) {
  const { className, ...rest } = props;
  return <div className={cn("rounded-lg border bg-card", className)} {...rest} />;
}

export function ChainOfActionTrigger(props: {
  title: string;
  subtitle?: string;
  status?: ChainOfActionStatus;
  statusLabel?: string;
  meta?: string;
  expanded?: boolean;
  loading?: boolean;
  onToggle?: () => void;
  className?: string;
}) {
  const {
    title,
    subtitle,
    status = "idle",
    statusLabel,
    meta,
    expanded = false,
    loading = false,
    onToggle,
    className,
  } = props;
  const ToggleIcon = expanded ? ChevronDown : ChevronRight;
  const isRunning = loading || status === "running";

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40",
        className,
      )}
      onClick={onToggle}
    >
      {isRunning ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <ToggleIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        {subtitle ? (
          <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        {meta ? <div className="text-[11px] text-muted-foreground">{meta}</div> : null}
        {statusLabel ? (
          <span
            className={cn(
              "mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              STATUS_STYLES[status],
            )}
          >
            {statusLabel}
          </span>
        ) : null}
      </div>
    </button>
  );
}

export function ChainOfActionContent(props: {
  open: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const { open, className, children } = props;
  if (!open) return null;
  return <div className={cn("border-t px-3 py-2", className)}>{children}</div>;
}

export function ChainOfActionShimmer(props: { label?: string; className?: string }) {
  const { label, className } = props;
  return (
    <div className={cn("", className)}>
      <div className="inline-flex items-center gap-2 rounded-md bg-muted/40 px-3 py-1.5">
        <span className="claw-shimmer h-2.5 w-2.5 shrink-0 rounded-full" />
        {label ? (
          <span className="text-sm font-semibold tracking-wide text-foreground/85">{label}</span>
        ) : null}
      </div>
    </div>
  );
}

export function ChainOfActionSteps(props: React.ComponentPropsWithoutRef<"div">) {
  const { className, ...rest } = props;
  return <div className={cn("space-y-2", className)} {...rest} />;
}

export function ChainOfActionStep(props: {
  title: string;
  status: ChainOfActionStatus;
  statusLabel: string;
  meta?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { title, status, statusLabel, meta, className, children } = props;
  return (
    <div className={cn("rounded-md border bg-muted/40", className)}>
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0 truncate text-xs font-medium">{title}</div>
        <div className="shrink-0 text-right">
          {meta ? <div className="text-[10px] text-muted-foreground">{meta}</div> : null}
          <span
            className={cn(
              "mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              STATUS_STYLES[status],
            )}
          >
            {statusLabel}
          </span>
        </div>
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}
