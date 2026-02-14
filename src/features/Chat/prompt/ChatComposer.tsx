import {
  Attachments,
  type AttachmentItem,
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputTools,
  PromptInputSubmit,
} from "@clawui/ui";
import { Paperclip } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { SessionControlStrip } from "../components/SessionControlStrip";
import { ExecApprovalInlinePanel, useHasPendingExecApproval } from "./ExecApprovalInlinePanel";

type LocalAttachment = {
  id: string;
  image: ComposerImageAttachment;
  item: AttachmentItem;
  objectUrl?: string;
};

export type ComposerImageAttachment = {
  id: string;
  filename: string;
  mediaType: string;
  size: number;
};

const MAX_IMAGE_ATTACHMENTS = 5;

function createLocalId(): string {
  const cryptoObj = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ChatComposer(props: {
  sessionKey: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (payload: { text: string; images: ComposerImageAttachment[] }) => Promise<void> | void;
  disabled: boolean;
  showSessionControls?: boolean;
  sessionControlsDisabled: boolean;
  className?: string;
}) {
  const { t } = useTranslation("chat");
  const {
    sessionKey,
    value,
    onChange,
    onSubmit,
    disabled,
    showSessionControls = true,
    sessionControlsDisabled,
    className,
  } = props;

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composingRef = useRef(false);
  const hasPendingApproval = useHasPendingExecApproval(sessionKey);
  const composerDisabled = disabled || hasPendingApproval;

  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const attachmentsRef = useRef<LocalAttachment[]>([]);

  const canSubmit = !composerDisabled && (value.trim().length > 0 || attachments.length > 0);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  // Cleanup object URLs when unmounting.
  useEffect(() => {
    return () => {
      for (const a of attachmentsRef.current) {
        if (a.objectUrl) URL.revokeObjectURL(a.objectUrl);
      }
    };
  }, []);

  const attachmentItems: AttachmentItem[] = useMemo(
    () => attachments.map((a) => a.item),
    [attachments],
  );

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.objectUrl) URL.revokeObjectURL(target.objectUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const onPickFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const next: LocalAttachment[] = [];
    const remainingSlots = Math.max(0, MAX_IMAGE_ATTACHMENTS - attachmentsRef.current.length);
    if (remainingSlots === 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    let acceptedCount = 0;
    for (const file of Array.from(files)) {
      if (!file.type.toLowerCase().startsWith("image/")) continue;
      if (acceptedCount >= remainingSlots) break;
      const id = createLocalId();
      const objectUrl = URL.createObjectURL(file);
      const image: ComposerImageAttachment = {
        id,
        filename: file.name || "image",
        mediaType: file.type || "image/*",
        size: Number.isFinite(file.size) ? file.size : 0,
      };
      next.push({
        id,
        image,
        objectUrl,
        item: {
          id,
          filename: image.filename,
          mediaType: file.type || undefined,
          url: objectUrl,
        },
      });
      acceptedCount += 1;
    }
    if (next.length > 0) {
      setAttachments((prev) => [...prev, ...next]);
    }
    // reset so the same file can be picked twice
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = async () => {
    if (composerDisabled) return;
    await onSubmit({
      text: value.trim(),
      images: attachments.map((attachment) => attachment.image),
    });
    // v1: attachments are UI-only; clear after submit to avoid confusion.
    setAttachments((prev) => {
      for (const a of prev) if (a.objectUrl) URL.revokeObjectURL(a.objectUrl);
      return [];
    });
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;

    const nativeEvent = e.nativeEvent as KeyboardEvent & { keyCode?: number };
    const isComposing =
      composingRef.current || nativeEvent.isComposing || nativeEvent.keyCode === 229;

    // 输入法选词/上屏时按 Enter，不应触发发送。
    if (isComposing) return;

    // 仅纯 Enter 发送；组合键一律保留换行行为（Cmd/Ctrl/Shift/Alt + Enter）。
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    if (composerDisabled || (value.trim().length === 0 && attachmentsRef.current.length === 0)) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    void submit();
  };

  return (
    <div className={cn("mx-auto w-full max-w-3xl", className)}>
      <ExecApprovalInlinePanel sessionKey={sessionKey} />
      <PromptInput onSubmit={() => void submit()}>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/*"
          onChange={(e) => onPickFiles(e.target.files)}
        />

        <div className="space-y-2 px-4 pt-3">
          <Attachments
            items={attachmentItems}
            onRemove={removeAttachment}
            removeLabel={t("removeAttachment")}
          />
          {hasPendingApproval ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-900 dark:text-amber-200">
              {t("execApproval.pendingInChat")}
            </div>
          ) : null}
        </div>

        <PromptInputTextarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("inputPlaceholder")}
          disabled={disabled}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
          onKeyDown={onKeyDown}
        />

        <PromptInputFooter className="flex-nowrap items-center gap-1.5 border-t-0">
          <PromptInputTools className="min-w-0 flex-1 flex-nowrap items-center gap-1.5">
            <PromptInputAction
              type="button"
              onClick={openFilePicker}
              disabled={composerDisabled}
              aria-label={t("attachFile")}
              title={t("attachFile")}
              className="w-8 px-0"
            >
              <Paperclip className="h-4 w-4" />
            </PromptInputAction>

            {showSessionControls ? (
              <SessionControlStrip
                sessionKey={sessionKey}
                disabled={sessionControlsDisabled || hasPendingApproval}
                className="mt-0"
              />
            ) : null}
          </PromptInputTools>

          <PromptInputActions className="ml-auto">
            <PromptInputSubmit disabled={!canSubmit}>{t("sendMessage")}</PromptInputSubmit>
          </PromptInputActions>
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
