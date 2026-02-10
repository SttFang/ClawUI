import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { cn } from "@/lib/utils";
import { SessionControlStrip } from "../components/SessionControlStrip";

type LocalAttachment = {
  id: string;
  item: AttachmentItem;
  objectUrl?: string;
};

function createLocalId(): string {
  const cryptoObj = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ChatComposer(props: {
  sessionKey: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => Promise<void> | void;
  disabled: boolean;
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
    sessionControlsDisabled,
    className,
  } = props;

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);

  // Cleanup object URLs when unmounting.
  useEffect(() => {
    return () => {
      for (const a of attachments) {
        if (a.objectUrl) URL.revokeObjectURL(a.objectUrl);
      }
    };
  }, [attachments]);

  const attachmentItems: AttachmentItem[] = useMemo(() => attachments.map((a) => a.item), [
    attachments,
  ]);

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
    for (const file of Array.from(files)) {
      const id = createLocalId();
      const objectUrl = URL.createObjectURL(file);
      next.push({
        id,
        objectUrl,
        item: {
          id,
          filename: file.name || "file",
          mediaType: file.type || undefined,
          url: objectUrl,
        },
      });
    }
    setAttachments((prev) => [...prev, ...next]);
    // reset so the same file can be picked twice
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = async () => {
    await onSubmit();
    // v1: attachments are UI-only; clear after submit to avoid confusion.
    setAttachments((prev) => {
      for (const a of prev) if (a.objectUrl) URL.revokeObjectURL(a.objectUrl);
      return [];
    });
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className={cn("mx-auto w-full max-w-3xl", className)}>
      <PromptInput onSubmit={() => void submit()}>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={(e) => onPickFiles(e.target.files)}
        />

        <div className="px-4 pt-3">
          <Attachments items={attachmentItems} onRemove={removeAttachment} removeLabel={t("removeAttachment")} />
        </div>

        <PromptInputTextarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("inputPlaceholder")}
          disabled={disabled}
          onKeyDown={onKeyDown}
        />

        <PromptInputFooter className="flex-col items-stretch gap-2">
          <div className="flex items-center justify-between gap-2">
            <PromptInputTools>
              <PromptInputAction
                type="button"
                onClick={openFilePicker}
                disabled={disabled}
                aria-label={t("attachFile")}
              >
                {t("attachFile")}
              </PromptInputAction>
            </PromptInputTools>
            <PromptInputActions>
              <PromptInputSubmit disabled={disabled || !value.trim()}>{t("sendMessage")}</PromptInputSubmit>
            </PromptInputActions>
          </div>

          <SessionControlStrip sessionKey={sessionKey} disabled={sessionControlsDisabled} className="mt-0" />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

