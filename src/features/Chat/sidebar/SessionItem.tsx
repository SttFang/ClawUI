import type { ClawUISessionMetadata } from "@clawui/types/clawui";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@clawui/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@clawui/ui";
import { OpenClaw } from "@lobehub/icons";
import { MessageSquare, MoreHorizontal, Sparkles, Terminal, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaDiscord, FaSlack, FaTelegramPlane, FaWhatsapp } from "react-icons/fa";
import { useClipboard } from "@/hooks/useClipboard";
import { cn } from "@/lib/utils";
import type { SessionListItem } from "../types";
import { classifySession } from "../utils/sessionKey";

function formatRelativeTime(updatedAt: number): string {
  if (!updatedAt || !Number.isFinite(updatedAt)) return "—";
  const diffMs = Date.now() - updatedAt;
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d`;
}

function SourceIcon(props: { source: string }) {
  const { source } = props;
  if (source === "ui") return <OpenClaw.Color size={14} />;
  if (source === "discord") return <FaDiscord className="h-3.5 w-3.5 text-[#5865F2]" />;
  if (source === "slack") return <FaSlack className="h-3.5 w-3.5 text-[#4A154B]" />;
  if (source === "telegram") return <FaTelegramPlane className="h-3.5 w-3.5 text-[#229ED9]" />;
  if (source === "whatsapp") return <FaWhatsapp className="h-3.5 w-3.5 text-[#25D366]" />;
  if (source === "acp") return <Terminal className="h-3.5 w-3.5 text-emerald-500" />;
  return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
}

export function SessionItem(props: {
  session: SessionListItem;
  selected: boolean;
  metadata?: ClawUISessionMetadata;
  metaBusy: boolean;
  onSelect: () => void;
  onRename: (label: string) => void;
  onGenerateMetadata: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("chat");
  const {
    session,
    selected,
    metadata,
    metaBusy,
    onSelect,
    onRename,
    onGenerateMetadata,
    onDelete,
  } = props;

  const { source } = classifySession({ sessionKey: session.id, surface: session.surface });
  const updatedText = useMemo(() => formatRelativeTime(session.updatedAt), [session.updatedAt]);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const { copied: copyOk, copy: copyText } = useClipboard({ resetMs: 1200 });

  const openRename = () => {
    setRenameValue(session.name ?? "");
    setRenameOpen(true);
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer",
        "hover:bg-accent transition-colors",
        selected && "bg-accent",
      )}
      onClick={onSelect}
      data-testid="session-item"
    >
      <SourceIcon source={source} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{metadata?.title ?? session.name}</div>
        {metadata?.summary ? (
          <div className="truncate text-xs text-muted-foreground">{metadata.summary}</div>
        ) : null}
      </div>

      <div className="ml-2 flex items-center gap-2">
        <div className="text-[11px] text-muted-foreground tabular-nums">{updatedText}</div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "rounded-md border bg-background/70 p-1",
                "text-muted-foreground hover:text-foreground hover:bg-accent",
                "transition-opacity",
                "opacity-0 group-hover:opacity-100",
              )}
              aria-label={t("sessionMenu.moreAria")}
              data-testid="session-more"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                openRename();
              }}
            >
              {t("sessionMenu.rename")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={metaBusy}
              onSelect={(e) => {
                e.preventDefault();
                onGenerateMetadata();
              }}
            >
              <span className="flex items-center gap-2">
                <Sparkles className={cn("h-4 w-4", metaBusy && "animate-pulse")} />
                {t("sessionMenu.generateSummary")}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                void copyText(session.id);
              }}
            >
              {copyOk ? t("sessionMenu.copied") : t("sessionMenu.copyId")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(e) => {
                e.preventDefault();
                const ok = window.confirm(t("sessionMenu.confirmDelete"));
                if (!ok) return;
                onDelete();
              }}
            >
              <span className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                {t("sessionMenu.delete")}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{t("sessionMenu.renameTitle")}</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder={t("sessionMenu.renamePlaceholder")}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onRename(renameValue.trim());
                  setRenameOpen(false);
                }
              }}
            />
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setRenameOpen(false)} type="button">
              {t("sessionMenu.cancel")}
            </Button>
            <Button
              onClick={() => {
                onRename(renameValue.trim());
                setRenameOpen(false);
              }}
              type="button"
            >
              {t("sessionMenu.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
