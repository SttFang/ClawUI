import type { ClawUISessionMetadata } from "@clawui/types/clawui";
import { MessageSquare, Sparkles, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { SessionListItem } from "../types";
import { classifySession, getSessionSourceBadge } from "../utils/sessionKey";

export function SessionItem(props: {
  session: SessionListItem;
  selected: boolean;
  metadata?: ClawUISessionMetadata;
  metaBusy: boolean;
  onSelect: () => void;
  onGenerateMetadata: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("chat");
  const { session, selected, metadata, metaBusy, onSelect, onGenerateMetadata, onDelete } = props;

  const { source } = classifySession({ sessionKey: session.id, surface: session.surface });
  const badge = getSessionSourceBadge(source);

  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer",
        "hover:bg-accent transition-colors",
        selected && "bg-accent",
      )}
      onClick={onSelect}
    >
      <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{metadata?.title ?? session.name}</div>
        {metadata?.summary ? (
          <div className="truncate text-xs text-muted-foreground">{metadata.summary}</div>
        ) : null}
      </div>

      {badge ? (
        <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {badge}
        </span>
      ) : null}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onGenerateMetadata();
        }}
        className="opacity-0 group-hover:opacity-100 p-1 hover:text-foreground transition-opacity"
        aria-label={t("generateSessionMetaAria")}
        disabled={metaBusy}
      >
        <Sparkles className={cn("w-3 h-3", metaBusy && "animate-pulse")} />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity"
        aria-label={t("deleteSessionAria")}
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}
