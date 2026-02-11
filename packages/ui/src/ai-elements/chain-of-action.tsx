import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "../utils";

export function ChainOfAction(props: React.ComponentPropsWithoutRef<"div">) {
  const { className, ...rest } = props;
  return <div className={cn("rounded-lg border bg-card", className)} {...rest} />;
}

export function ChainOfActionTrigger(props: {
  title: string;
  subtitle?: string;
  expanded?: boolean;
  loading?: boolean;
  onToggle?: () => void;
  className?: string;
}) {
  const { title, subtitle, expanded = false, loading = false, onToggle, className } = props;
  const ToggleIcon = expanded ? ChevronDown : ChevronRight;

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40",
        className,
      )}
      onClick={onToggle}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <ToggleIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">{title}</div>
        {subtitle ? (
          <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>
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
