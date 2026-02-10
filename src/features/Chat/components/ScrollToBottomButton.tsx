import { ArrowDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStickToBottomContext } from "use-stick-to-bottom";
import { cn } from "@/lib/utils";

export function ScrollToBottomButton() {
  const { t } = useTranslation("chat");
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  if (isAtBottom) return null;

  return (
    <button
      type="button"
      className={cn(
        "absolute bottom-3 left-1/2 -translate-x-1/2",
        "flex items-center gap-2 rounded-full border bg-background/90 px-3 py-1.5 text-xs shadow-sm",
        "text-muted-foreground hover:text-foreground hover:bg-background",
      )}
      onClick={() => void scrollToBottom()}
      aria-label={t("scrollToLatestAria")}
    >
      <ArrowDown className="h-4 w-4" />
      <span>{t("scrollToLatest")}</span>
    </button>
  );
}
