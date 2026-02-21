import { Collapsible, CollapsibleTrigger, CollapsibleContent, ScrollArea, cn } from "@clawui/ui";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
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

type Segment =
  | { kind: "text"; index: number; part: SubagentMessagePart & { type: "text" } }
  | { kind: "thinking"; index: number; part: SubagentMessagePart & { type: "thinking" } }
  | { kind: "tool_result"; index: number; part: SubagentMessagePart & { type: "tool_result" } }
  | {
      kind: "tool_group";
      startIndex: number;
      calls: (SubagentMessagePart & { type: "tool_call" })[];
    };

/** Collapse consecutive tool_call parts into groups; keep everything else as-is. */
function segmentParts(parts: SubagentMessagePart[], pairedResultIds: Set<string>): Segment[] {
  const segments: Segment[] = [];
  let pendingCalls: (SubagentMessagePart & { type: "tool_call" })[] = [];
  let groupStart = 0;

  const flushCalls = () => {
    if (pendingCalls.length > 0) {
      segments.push({ kind: "tool_group", startIndex: groupStart, calls: pendingCalls });
      pendingCalls = [];
    }
  };

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    // Skip paired tool_results (they render inline with their tool_call)
    if (part.type === "tool_result" && part.toolCallId && pairedResultIds.has(part.toolCallId)) {
      continue;
    }
    if (part.type === "tool_call") {
      if (pendingCalls.length === 0) groupStart = i;
      pendingCalls.push(part);
      continue;
    }
    flushCalls();
    if (part.type === "text") segments.push({ kind: "text", index: i, part });
    else if (part.type === "thinking") segments.push({ kind: "thinking", index: i, part });
    else if (part.type === "tool_result") segments.push({ kind: "tool_result", index: i, part });
  }
  flushCalls();
  return segments;
}

/** Max height before the tool group becomes scrollable (px). */
const TOOL_GROUP_MAX_H = 280;

function ToolCallGroup({
  calls,
  resultMap,
}: {
  calls: (SubagentMessagePart & { type: "tool_call" })[];
  resultMap: Map<string, { content: string; isError?: boolean }>;
}) {
  const { t } = useTranslation("common");
  return (
    <div className="rounded-md border border-border/40">
      <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-muted-foreground">
        <span>{t("subagent.toolCalls", { count: calls.length })}</span>
      </div>
      <ScrollArea className="px-1 pb-1" style={{ maxHeight: TOOL_GROUP_MAX_H }}>
        <div className="space-y-0.5">
          {calls.map((call, i) => (
            <ToolCallBlock
              key={call.toolCallId || i}
              toolName={call.toolName}
              args={call.args}
              result={call.toolCallId ? resultMap.get(call.toolCallId) : undefined}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export function SubagentMessageParts({ parts }: { parts: SubagentMessagePart[] }) {
  const resultMap = new Map<string, { content: string; isError?: boolean }>();
  for (const part of parts) {
    if (part.type === "tool_result" && part.toolCallId) {
      resultMap.set(part.toolCallId, { content: part.content, isError: part.isError });
    }
  }

  const segments = segmentParts(parts, new Set(resultMap.keys()));

  return (
    <div className="space-y-2">
      {segments.map((seg) => {
        switch (seg.kind) {
          case "text":
            return (
              <div key={seg.index} className="text-xs">
                <MessageText text={seg.part.text} isAnimating={false} />
              </div>
            );
          case "thinking":
            return <ThinkingBlock key={seg.index} thinking={seg.part.thinking} />;
          case "tool_group":
            return (
              <ToolCallGroup key={`tg:${seg.startIndex}`} calls={seg.calls} resultMap={resultMap} />
            );
          case "tool_result":
            return (
              <ToolResultBlock
                key={seg.index}
                content={seg.part.content}
                isError={seg.part.isError}
              />
            );
        }
      })}
    </div>
  );
}
