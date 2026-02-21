import { Collapsible, CollapsibleTrigger, CollapsibleContent, cn } from "@clawui/ui";
import { ChevronRight } from "lucide-react";
import type { SubagentMessagePart } from "@/store/subagents";
import { MessageText } from "../MessageText";

function ThinkingBlock({ thinking }: { thinking: string }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
        <ChevronRight className="size-3 transition-transform group-data-[state=open]:rotate-90" />
        <span className="italic">thinking…</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 pl-4 text-xs text-muted-foreground/80">
        <span className="whitespace-pre-wrap break-words">{thinking}</span>
      </CollapsibleContent>
    </Collapsible>
  );
}

function argsSummary(args: Record<string, unknown>): string {
  const keys = Object.keys(args);
  if (keys.length === 0) return "";
  const preview = keys
    .slice(0, 3)
    .map((k) => {
      const v = args[k];
      if (typeof v === "string") return `${k}="${v.length > 40 ? v.slice(0, 40) + "…" : v}"`;
      return `${k}=${JSON.stringify(v)}`;
    })
    .join(", ");
  return keys.length > 3 ? `${preview}, …` : preview;
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
  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex items-center gap-1 text-[10px] font-mono text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
        <ChevronRight className="size-3 transition-transform group-data-[state=open]:rotate-90" />
        <span>
          ▶ {toolName}({argsSummary(args)})
        </span>
        {result && (
          <span
            className={cn(
              "ml-1",
              result.isError ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {result.isError ? "✗" : "✓"}
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 space-y-1 pl-4">
        <pre className="whitespace-pre-wrap break-words rounded bg-muted/50 p-2 text-[10px] text-muted-foreground">
          {JSON.stringify(args, null, 2)}
        </pre>
        {result && (
          <pre
            className={cn(
              "whitespace-pre-wrap break-words rounded p-2 text-[10px]",
              result.isError
                ? "bg-red-500/10 text-red-700 dark:text-red-400"
                : "bg-orange-500/5 text-muted-foreground",
            )}
          >
            {result.content.length > 500 ? result.content.slice(0, 500) + "…" : result.content}
          </pre>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ToolResultBlock({ content, isError }: { content: string; isError?: boolean }) {
  const preview = content.length > 120 ? content.slice(0, 120) + "…" : content;
  const needsExpand = content.length > 120;

  if (!needsExpand) {
    return (
      <div
        className={cn(
          "rounded px-2 py-1 text-[10px] font-mono whitespace-pre-wrap break-words",
          isError
            ? "bg-red-500/10 text-red-700 dark:text-red-400"
            : "bg-orange-500/5 text-muted-foreground",
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
          "group flex items-center gap-1 text-[10px] font-mono",
          isError
            ? "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <ChevronRight className="size-3 transition-transform group-data-[state=open]:rotate-90" />
        <span>{preview}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 pl-4">
        <pre
          className={cn(
            "whitespace-pre-wrap break-words rounded p-2 text-[10px]",
            isError
              ? "bg-red-500/10 text-red-700 dark:text-red-400"
              : "bg-orange-500/5 text-muted-foreground",
          )}
        >
          {content}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function SubagentMessageParts({ parts }: { parts: SubagentMessagePart[] }) {
  // Build a map of toolCallId → tool_result for pairing
  const resultMap = new Map<string, { content: string; isError?: boolean }>();
  for (const part of parts) {
    if (part.type === "tool_result" && part.toolCallId) {
      resultMap.set(part.toolCallId, { content: part.content, isError: part.isError });
    }
  }

  return (
    <div className="space-y-1.5">
      {parts.map((part, i) => {
        switch (part.type) {
          case "text":
            return (
              <div key={i} className="text-xs">
                <MessageText text={part.text} isAnimating={false} />
              </div>
            );
          case "thinking":
            return <ThinkingBlock key={i} thinking={part.thinking} />;
          case "tool_call":
            return (
              <ToolCallBlock
                key={i}
                toolName={part.toolName}
                args={part.args}
                result={part.toolCallId ? resultMap.get(part.toolCallId) : undefined}
              />
            );
          case "tool_result":
            // Skip standalone render — already paired with tool_call above
            if (part.toolCallId && resultMap.has(part.toolCallId)) return null;
            return <ToolResultBlock key={i} content={part.content} isError={part.isError} />;
        }
      })}
    </div>
  );
}
