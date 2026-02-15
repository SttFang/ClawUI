import { Button, Input } from "@clawui/ui";
import { ArrowUp } from "lucide-react";
import { useCallback, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useRescueStore, selectRescueInput } from "@/store/rescue";

export function RescueComposer() {
  const { t } = useTranslation("common");
  const input = useRescueStore(selectRescueInput);
  const setInput = useRescueStore((s) => s.setInput);
  const sendMessage = useRescueStore((s) => s.sendMessage);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
  }, [input, sendMessage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex items-center gap-2 border-t px-4 py-3">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("rescue.inputPlaceholder")}
        className="flex-1"
      />
      <Button size="icon" variant="ghost" onClick={handleSend} disabled={!input.trim()}>
        <ArrowUp className="h-4 w-4" />
      </Button>
    </div>
  );
}
