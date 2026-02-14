import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChatComposer } from "../ChatComposer";
const useHasPendingExecApprovalMock = vi.fn(() => false);

let capturedTextareaKeyDown: ((event: ReactKeyboardEvent<HTMLTextAreaElement>) => void) | null =
  null;
let lastSubmitDisabled: boolean | null = null;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/features/Chat/prompt/ExecApprovalInlinePanel", () => ({
  ExecApprovalInlinePanel: () => null,
  useHasPendingExecApproval: () => useHasPendingExecApprovalMock(),
}));

vi.mock("@clawui/ui", async () => {
  const actual = await vi.importActual<typeof import("@clawui/ui")>("@clawui/ui");
  return {
    ...actual,
    Attachments: ({ children }: { children?: ReactNode }) => children,
    PromptInput: ({ children }: { children?: ReactNode }) => createElement("div", null, children),
    PromptInputAction: ({ children }: { children?: ReactNode }) =>
      createElement("button", null, children),
    PromptInputTools: ({ children, className }: { children?: ReactNode; className?: string }) =>
      createElement("div", { className }, children),
    PromptInputActions: ({ children }: { children?: ReactNode }) =>
      createElement("div", null, children),
    PromptInputSubmit: ({ children, disabled }: { children?: ReactNode; disabled?: boolean }) => {
      lastSubmitDisabled = Boolean(disabled);
      return createElement("button", { disabled }, children);
    },
    PromptInputTextarea: ({
      onKeyDown,
      onCompositionStart,
      onCompositionEnd,
      onChange,
      value,
      disabled,
      placeholder,
      ref,
    }: {
      onKeyDown?: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
      onCompositionStart?: () => void;
      onCompositionEnd?: () => void;
      onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void;
      value?: string;
      disabled?: boolean;
      placeholder?: string;
      ref?: RefObject<HTMLTextAreaElement> | null;
    }) => {
      capturedTextareaKeyDown = onKeyDown ?? null;
      return createElement("textarea", {
        onKeyDown,
        onCompositionStart,
        onCompositionEnd,
        onChange,
        value,
        disabled,
        placeholder,
        ref,
      });
    },
  };
});

describe("ChatComposer", () => {
  const renderComposer = (
    onSubmit: (payload: { text: string; images: unknown[] }) => void,
    hasPending: boolean,
    value = "hello",
  ) => {
    lastSubmitDisabled = null;
    capturedTextareaKeyDown = null;
    useHasPendingExecApprovalMock.mockReturnValue(hasPending);
    renderToStaticMarkup(
      createElement(ChatComposer, {
        sessionKey: "session-1",
        value,
        onChange: vi.fn(),
        onSubmit,
        disabled: false,
        sessionControlsDisabled: false,
        showSessionControls: false,
        className: "",
      }),
    );
  };

  it("blocks Enter submit when approval is pending", async () => {
    const onSubmit = vi.fn((_payload: { text: string; images: unknown[] }) => {});
    renderComposer(onSubmit, true);

    expect(lastSubmitDisabled).toBe(true);

    const event = {
      key: "Enter",
      nativeEvent: {
        isComposing: false,
        keyCode: 13,
      },
      preventDefault: vi.fn(),
    } as unknown as ReactKeyboardEvent<HTMLTextAreaElement>;
    capturedTextareaKeyDown?.(event);
    await Promise.resolve();

    expect(event.preventDefault).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sends on bare Enter when no approval block exists", async () => {
    const onSubmit = vi.fn((_payload: { text: string; images: unknown[] }) => {});
    renderComposer(onSubmit, false);

    const event = {
      key: "Enter",
      nativeEvent: {
        isComposing: false,
        keyCode: 13,
      },
      preventDefault: vi.fn(),
    } as unknown as ReactKeyboardEvent<HTMLTextAreaElement>;
    capturedTextareaKeyDown?.(event);
    await Promise.resolve();

    expect(event.preventDefault).toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ text: "hello", images: [] });
  });

  it("keeps Shift+Enter as multiline when approval is pending", async () => {
    const onSubmit = vi.fn((_payload: { text: string; images: unknown[] }) => {});
    renderComposer(onSubmit, true);

    const event = {
      key: "Enter",
      shiftKey: true,
      nativeEvent: {
        isComposing: false,
        keyCode: 13,
      },
      preventDefault: vi.fn(),
    } as unknown as ReactKeyboardEvent<HTMLTextAreaElement>;
    capturedTextareaKeyDown?.(event);
    await Promise.resolve();

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks IME Enter from submitting", async () => {
    const onSubmit = vi.fn((_payload: { text: string; images: unknown[] }) => {});
    renderComposer(onSubmit, false);

    const event = {
      key: "Enter",
      nativeEvent: {
        isComposing: true,
        keyCode: 229,
      },
      preventDefault: vi.fn(),
    } as unknown as ReactKeyboardEvent<HTMLTextAreaElement>;
    capturedTextareaKeyDown?.(event);
    await Promise.resolve();

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("prevents submit when input is blank", async () => {
    const onSubmit = vi.fn((_payload: { text: string; images: unknown[] }) => {});
    renderComposer(onSubmit, false, "   ");

    const event = {
      key: "Enter",
      nativeEvent: {
        isComposing: false,
        keyCode: 13,
      },
      preventDefault: vi.fn(),
    } as unknown as ReactKeyboardEvent<HTMLTextAreaElement>;
    capturedTextareaKeyDown?.(event);
    await Promise.resolve();

    expect(event.preventDefault).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
