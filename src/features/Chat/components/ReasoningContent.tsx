import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function ReasoningContent(props: { text: string; isStreaming: boolean }) {
  const { text, isStreaming } = props;
  const { t } = useTranslation("chat");
  const [expanded, setExpanded] = useState(false);

  // Auto-expand while streaming
  const isOpen = isStreaming || expanded;

  return (
    <div className="rounded-md border border-border/50 bg-muted/30">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        aria-label={t("reasoning.toggle")}
      >
        <ChevronRight className={cn("size-3.5 transition-transform", isOpen && "rotate-90")} />
        <span>{t("reasoning.label")}</span>
      </button>
      {isOpen && (
        <div className="border-t border-border/50 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  );
}
