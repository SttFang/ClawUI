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
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  getPendingApprovalsForSession,
  useExecApprovalsStore,
  type ExecApprovalDecision,
} from "@/store/exec";
import { SessionControlStrip } from "../components/SessionControlStrip";
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
  const { t: tc } = useTranslation("common");
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

  // --- Approval confirmation transition ---
  const pendingCommand = useExecApprovalsStore((s) => {
    const pending = getPendingApprovalsForSession(s.queue, sessionKey.trim());
    const cmd = pending[0]?.request.command;
    if (!cmd) return null;
    const first = cmd.trimStart().split("\n")[0];
    return first.length > 50 ? `${first.slice(0, 50)}…` : first;
  });
  const lastPendingCmdRef = useRef<string | null>(null);
  if (pendingCommand) lastPendingCmdRef.current = pendingCommand;

  const lastResolved = useExecApprovalsStore((s) => s.lastResolvedBySession[sessionKey.trim()]);

  const [confirmedDecision, setConfirmedDecision] = useState<ExecApprovalDecision | null>(null);

  const prevHasPending = useRef(hasPendingApproval);
  useEffect(() => {
    if (prevHasPending.current && !hasPendingApproval && lastResolved) {
      setConfirmedDecision(lastResolved.decision);
    }
    prevHasPending.current = hasPendingApproval;
  }, [hasPendingApproval, lastResolved]);

  useEffect(() => {
    if (!confirmedDecision) return;
    if (!disabled) {
      setConfirmedDecision(null);
      return;
    }
    const timer = setTimeout(() => setConfirmedDecision(null), 10_000);
    return () => clearTimeout(timer);
  }, [disabled, confirmedDecision]);

  const showConfirmation = confirmedDecision !== null;
  const isAllowed = confirmedDecision === "allow-once" || confirmedDecision === "allow-always";

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
        ) : showConfirmation ? (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
            <span
              className={cn(
                "inline-block size-2 shrink-0 rounded-full",
                isAllowed ? "animate-pulse bg-blue-500" : "bg-destructive",
              )}
            />
            <span>
              {tc(isAllowed ? "execApproval.confirmed.allowed" : "execApproval.confirmed.denied")}
            </span>
            <code className="min-w-0 truncate rounded bg-muted px-1.5 py-0.5 text-xs">
              {lastPendingCmdRef.current}
            </code>
          </div>
        ) : (
          <div className="space-y-2 px-4 pt-3">
            <Attachments
              items={attachmentItems}
              onRemove={removeAttachment}
              removeLabel={t("removeAttachment")}
            />
          </div>
        )}

        {hasPendingApproval || showConfirmation ? null : (
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

        {hasPendingApproval || showConfirmation ? null : (
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
