import type { DynamicToolUIPart } from "ai";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@clawui/ui";
import { cn } from "@/lib/utils";
import { buildToolSummary, formatJson, truncate } from "./toolHelpers";

const PREVIEW_CHARS = 600;

function StatusDot(props: { status: "done" | "error" | "running" }) {
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        props.status === "done" && "bg-emerald-500",
        props.status === "error" && "bg-destructive",
        props.status === "running" && "animate-pulse bg-blue-500",
      )}
    />
  );
}

export function ToolItem(props: { part: DynamicToolUIPart }) {
  const { part } = props;
  const summary = buildToolSummary(part);
  const isDone = part.state === "output-available";
  const isError = part.state === "output-error";
  const dotStatus = isDone ? "done" : isError ? "error" : "running";

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex w-full items-center gap-2 py-1 text-sm transition-colors hover:text-foreground">
        <StatusDot status={dotStatus} />
        <span className="truncate text-muted-foreground">{summary}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 mt-1 mb-1">
          {isDone && part.output != null && (
            <pre className="max-h-48 overflow-auto rounded-md bg-muted px-2 py-1.5 text-xs break-words whitespace-pre-wrap">
              {truncate(formatJson(part.output), PREVIEW_CHARS)}
            </pre>
          )}
          {isError && <div className="text-xs text-destructive">{part.errorText}</div>}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
