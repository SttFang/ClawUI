import { Button } from "@clawui/ui";
import { MessageSquareText, Search, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuickActionStore } from "@/store/quickAction";

interface ToolbarPosition {
  top: number;
  left: number;
}

/** Try to get selection text and bounding rect, checking both parent document and iframes. */
function getSelectionInfo(container: HTMLElement) {
  // Check parent document first
  const sel = window.getSelection();
  if (sel && sel.toString().trim() && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    if (container.contains(range.commonAncestorContainer)) {
      return {
        text: sel.toString().trim(),
        rect: range.getBoundingClientRect(),
        clearSelection: () => sel.removeAllRanges(),
      };
    }
  }

  // Check iframes within the container
  const iframes = container.querySelectorAll("iframe");
  for (const iframe of iframes) {
    try {
      const iframeSel = iframe.contentWindow?.getSelection();
      if (iframeSel && iframeSel.toString().trim() && iframeSel.rangeCount > 0) {
        const range = iframeSel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const iframeRect = iframe.getBoundingClientRect();
        // Translate iframe-relative coords to parent coords
        const adjustedRect = {
          top: rect.top + iframeRect.top,
          left: rect.left + iframeRect.left,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom + iframeRect.top,
          right: rect.right + iframeRect.left,
        };
        return {
          text: iframeSel.toString().trim(),
          rect: adjustedRect as DOMRect,
          clearSelection: () => iframeSel.removeAllRanges(),
        };
      }
    } catch {
      // Cross-origin iframe — skip
    }
  }

  return null;
}

/**
 * Floating toolbar that appears above selected text in the workspace panel.
 * Must be rendered inside a `position: relative` container.
 */
export function SelectionToolbar() {
  const { t } = useTranslation("chat");
  const [position, setPosition] = useState<ToolbarPosition | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const toolbarRef = useRef<HTMLDivElement>(null);
  const clearSelectionRef = useRef<(() => void) | null>(null);

  const dismiss = useCallback(() => {
    setPosition(null);
    setSelectedText("");
    clearSelectionRef.current = null;
  }, []);

  const handleAction = useCallback(
    (text: string, autoSend: boolean) => {
      useQuickActionStore.getState().insertToChat(text, { autoSend });
      clearSelectionRef.current?.();
      dismiss();
    },
    [dismiss],
  );

  useEffect(() => {
    const container = toolbarRef.current?.parentElement;
    if (!container) return;

    const updateSelection = () => {
      const info = getSelectionInfo(container);
      if (!info) {
        dismiss();
        return;
      }

      const containerRect = container.getBoundingClientRect();
      clearSelectionRef.current = info.clearSelection;
      setPosition({
        top: info.rect.top - containerRect.top - 40,
        left: info.rect.left - containerRect.left + info.rect.width / 2,
      });
      setSelectedText(info.text);
    };

    const handleSelectionChange = () => {
      const info = getSelectionInfo(container);
      if (!info) dismiss();
    };

    // Listen on parent document
    document.addEventListener("mouseup", updateSelection);
    document.addEventListener("selectionchange", handleSelectionChange);

    // Also listen on iframes for mouseup
    const attachIframeListeners = () => {
      const iframes = container.querySelectorAll("iframe");
      for (const iframe of iframes) {
        try {
          iframe.contentDocument?.addEventListener("mouseup", updateSelection);
        } catch {
          // Cross-origin — skip
        }
      }
    };

    // Attach immediately + observe for dynamically added iframes
    attachIframeListeners();
    const observer = new MutationObserver(() => attachIframeListeners());
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("mouseup", updateSelection);
      document.removeEventListener("selectionchange", handleSelectionChange);
      observer.disconnect();
      // Clean up iframe listeners
      const iframes = container.querySelectorAll("iframe");
      for (const iframe of iframes) {
        try {
          iframe.contentDocument?.removeEventListener("mouseup", updateSelection);
        } catch {
          // ignore
        }
      }
    };
  }, [dismiss]);

  if (!position || !selectedText) return <div ref={toolbarRef} />;

  return (
    <div ref={toolbarRef}>
      <div
        className="absolute z-50 flex items-center gap-0.5 rounded-lg border bg-popover p-0.5 shadow-md"
        style={{
          top: Math.max(0, position.top),
          left: position.left,
          transform: "translateX(-50%)",
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => handleAction(`请解释以下内容：\n\n> ${selectedText}`, true)}
        >
          <MessageSquareText className="size-3.5" />
          {t("workspaceFiles.selection.explain")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => handleAction(`请搜索以下内容：${selectedText}`, true)}
        >
          <Search className="size-3.5" />
          {t("workspaceFiles.selection.search")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => handleAction(selectedText, true)}
        >
          <Send className="size-3.5" />
          {t("workspaceFiles.selection.send")}
        </Button>
      </div>
    </div>
  );
}
