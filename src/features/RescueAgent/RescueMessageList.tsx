import { ScrollArea } from "@clawui/ui";
import { cn } from "@clawui/ui";
import { useRef, useEffect } from "react";
import { useRescueStore, selectRescueMessages } from "@/store/rescue";

export function RescueMessageList() {
  const messages = useRescueStore(selectRescueMessages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <ScrollArea className="flex-1 px-4 py-3">
      <div className="space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              {msg.content}
              {msg.isStreaming && (
                <span className="ml-0.5 inline-block w-1.5 h-4 bg-current animate-pulse align-text-bottom" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
