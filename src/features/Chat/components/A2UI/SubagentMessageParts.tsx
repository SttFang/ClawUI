import { Collapsible, CollapsibleTrigger, CollapsibleContent, cn } from "@clawui/ui";
import { ChevronRight } from "lucide-react";
import type { SubagentMessagePart } from "@/store/subagents";
import { MessageText } from "../MessageText";

function argsSummary(args: Record<string, unknown>): string {
  const keys = Object.keys(args);
  if (keys.length === 0) return "";
  const preview = keys
    .slice(0, 2)
    .map((k) => {
      const v = args[k];
      if (typeof v === "string") return v.length > 30 ? `"${v.slice(0, 30)}…"` : `"${v}"`;
      return String(v);
    })
    .join(" ");
  return preview;
}

function ThinkingBlock({ thinking }: { thinking: string }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-md bg-muted/20 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground">
        <ChevronRight className="size-3 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
        <span>thinking</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 rounded-md border border-border/30 bg-muted/20 px-3 py-2">
        <span className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground/70">
          {thinking}
        </span>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ToolCallBlock({
  toolName,
  args,
  result,
}: {
  toolName: string;
  args: Record<string, unknown>;
  result?: { content: string; isError?: boolean };
}) {
  const summary = argsSummary(args);

  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-md bg-muted/30 px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground">
        <ChevronRight className="size-3 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
        <span className="font-semibold text-foreground">{toolName}</span>
        {summary && <span className="min-w-0 flex-1 truncate">{summary}</span>}
        {result && (
          <span
            className={cn(
              "shrink-0 text-[11px] font-bold",
              result.isError ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {result.isError ? "✗" : "✓"}
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 overflow-hidden rounded-md border border-border/50">
        <pre className="whitespace-pre-wrap break-words bg-muted/50 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
          {JSON.stringify(args, null, 2)}
        </pre>
        {result && (
          <pre
            className={cn(
              "whitespace-pre-wrap break-words border-t border-border/30 px-2 py-1.5 font-mono text-[10px]",
              result.isError
                ? "border-l-2 border-l-destructive/60 bg-destructive/10 text-destructive"
                : "border-l-2 border-l-emerald-500/40 bg-emerald-500/5 text-muted-foreground",
            )}
          >
            {result.content.length > 400 ? result.content.slice(0, 400) + "…" : result.content}
          </pre>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ToolResultBlock({ content, isError }: { content: string; isError?: boolean }) {
  const needsExpand = content.length > 200;
  const preview = needsExpand ? content.slice(0, 200) + "…" : content;

  if (!needsExpand) {
    return (
      <div
        className={cn(
          "rounded-md border-l-2 px-2 py-1 font-mono text-xs whitespace-pre-wrap break-words",
          isError
            ? "border-l-destructive/60 bg-destructive/10 text-destructive"
            : "border-l-emerald-500/40 bg-emerald-500/5 text-muted-foreground",
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <Collapsible>
      <CollapsibleTrigger
        className={cn(
          "group flex w-full items-center gap-2 rounded-md px-2 py-1 font-mono text-xs transition-colors",
          isError
            ? "text-destructive hover:bg-destructive/10"
            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
        )}
      >
        <ChevronRight className="size-3 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
        <span className="min-w-0 flex-1 truncate">{preview}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1">
        <pre
          className={cn(
            "whitespace-pre-wrap break-words rounded-md border-l-2 px-2 py-1.5 font-mono text-[10px]",
            isError
              ? "border-l-destructive/60 bg-destructive/10 text-destructive"
              : "border-l-emerald-500/40 bg-emerald-500/5 text-muted-foreground",
          )}
        >
          {content}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Spacing between part types: tool→tool is tight, text↔tool gets more room. */
function gapClass(prev: SubagentMessagePart["type"] | null, curr: SubagentMessagePart["type"]): string {
  if (!prev) return "";
  if (prev === "tool_call" && curr === "tool_call") return "mt-0.5";
  if (prev === "text" || curr === "text") return "mt-2";
  return "mt-1";
}

export function SubagentMessageParts({ parts }: { parts: SubagentMessagePart[] }) {
  const resultMap = new Map<string, { content: string; isError?: boolean }>();
  for (const part of parts) {
    if (part.type === "tool_result" && part.toolCallId) {
      resultMap.set(part.toolCallId, { content: part.content, isError: part.isError });
    }
  }

  let prevType: SubagentMessagePart["type"] | null = null;

  return (
    <div>
      {parts.map((part, i) => {
        // Skip paired tool_results
        if (part.type === "tool_result" && part.toolCallId && resultMap.has(part.toolCallId)) {
          return null;
        }

        const gap = gapClass(prevType, part.type);
        prevType = part.type;

        switch (part.type) {
          case "text":
            return (
              <div key={i} className={cn("text-xs", gap)}>
                <MessageText text={part.text} isAnimating={false} />
              </div>
            );
          case "thinking":
            return (
              <div key={i} className={gap}>
                <ThinkingBlock thinking={part.thinking} />
              </div>
            );
          case "tool_call":
            return (
              <div key={i} className={gap}>
                <ToolCallBlock
                  toolName={part.toolName}
                  args={part.args}
                  result={part.toolCallId ? resultMap.get(part.toolCallId) : undefined}
                />
              </div>
            );
          case "tool_result":
            return (
              <div key={i} className={gap}>
                <ToolResultBlock content={part.content} isError={part.isError} />
              </div>
            );
        }
      })}
    </div>
  );
}
