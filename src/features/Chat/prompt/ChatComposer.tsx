import {
  Attachments,
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputTools,
  PromptInputSubmit,
} from "@clawui/ui";
import { ArrowUp, Paperclip } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { SessionControlStrip } from "../components/SessionControlStrip";
import { AgentDropdown } from "./AgentDropdown";
import { ExecApprovalInlinePanel, useHasPendingExecApproval } from "./ExecApprovalInlinePanel";
import { useImageAttachments } from "./useImageAttachments";

export type { ComposerImageAttachment } from "./useImageAttachments";

export function ChatComposer(props: {
  sessionKey: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (payload: {
    text: string;
    images: import("./useImageAttachments").ComposerImageAttachment[];
  }) => Promise<void> | void;
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
  const composingRef = useRef(false);
  const hasPendingApproval = useHasPendingExecApproval(sessionKey);
  const composerDisabled = disabled || hasPendingApproval;

  const {
    attachments,
    attachmentsRef,
    attachmentItems,
    fileInputRef,
    removeAttachment,
    openFilePicker,
    onPickFiles,
    getImagesAndClear,
  } = useImageAttachments();

  const canSubmit = !composerDisabled && (value.trim().length > 0 || attachments.length > 0);

  const submit = async () => {
    if (composerDisabled) return;
    const images = getImagesAndClear();
    await onSubmit({ text: value.trim(), images });
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;

    const nativeEvent = e.nativeEvent as KeyboardEvent & { keyCode?: number };
    const isComposing =
      composingRef.current || nativeEvent.isComposing || nativeEvent.keyCode === 229;

    if (isComposing) return;
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
      <PromptInput onSubmit={() => void submit()}>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/*"
          onChange={(e) => onPickFiles(e.target.files)}
        />

        {hasPendingApproval ? (
          <ExecApprovalInlinePanel sessionKey={sessionKey} />
        ) : (
          <div className="space-y-2 px-4 pt-3">
            <Attachments
              items={attachmentItems}
              onRemove={removeAttachment}
              removeLabel={t("removeAttachment")}
            />
          </div>
        )}

        {hasPendingApproval ? null : (
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
        )}

        {hasPendingApproval ? null : (
          <PromptInputFooter className="flex-nowrap items-center gap-1.5 border-t-0">
            <PromptInputTools className="min-w-0 flex-1 flex-nowrap items-center gap-1.5">
              <PromptInputAction
                type="button"
                variant="ghost"
                size="icon"
                onClick={openFilePicker}
                disabled={composerDisabled}
                aria-label={t("attachFile")}
                title={t("attachFile")}
                className="h-7 w-7 text-muted-foreground"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </PromptInputAction>

              <AgentDropdown disabled={composerDisabled} />

              {showSessionControls ? (
                <SessionControlStrip
                  sessionKey={sessionKey}
                  disabled={sessionControlsDisabled || hasPendingApproval}
                  className="mt-0"
                />
              ) : null}
            </PromptInputTools>

            <PromptInputActions className="ml-auto">
              <PromptInputSubmit
                disabled={!canSubmit}
                variant="default"
                size="icon"
                className="h-8 w-8 rounded-full bg-foreground text-background hover:bg-foreground/90"
              >
                <ArrowUp className="h-4 w-4" />
              </PromptInputSubmit>
            </PromptInputActions>
          </PromptInputFooter>
        )}
      </PromptInput>
    </div>
  );
}
