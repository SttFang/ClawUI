import { cn } from "@clawui/ui";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useRescueStore, selectIsRescueOpen, selectRescueGatewayStatus } from "@/store/rescue";
import { RescueComposer } from "./RescueComposer";
import { RescueMessageList } from "./RescueMessageList";

const statusLabel: Record<string, string> = {
  running: "rescue.status.running",
  starting: "rescue.status.starting",
  stopped: "rescue.status.stopped",
  error: "rescue.status.error",
};

const statusColor: Record<string, string> = {
  running: "text-green-600",
  starting: "text-amber-500",
  stopped: "text-muted-foreground",
  error: "text-red-500",
};

export function RescueAgentPanel() {
  const { t } = useTranslation("common");
  const isOpen = useRescueStore(selectIsRescueOpen);
  const status = useRescueStore(selectRescueGatewayStatus);
  const close = useRescueStore((s) => s.close);
  const startGateway = useRescueStore((s) => s.startGateway);
  const connect = useRescueStore((s) => s.connect);
  const booted = useRef(false);

  // Auto-boot rescue gateway + websocket on first open
  useEffect(() => {
    if (!isOpen || booted.current) return;
    booted.current = true;

    (async () => {
      await startGateway();
      await connect();
    })();
  }, [isOpen, startGateway, connect]);

  if (!isOpen) return null;

  return (
    <div className="flex h-full w-[400px] shrink-0 flex-col border-l bg-background">
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{t("rescue.title")}</span>
          <span className={cn("text-xs", statusColor[status] ?? statusColor.stopped)}>
            {t(statusLabel[status] ?? statusLabel.stopped)}
          </span>
        </div>
        <button
          onClick={close}
          className="rounded-sm p-1 opacity-70 transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <RescueMessageList />

      {/* Composer */}
      <RescueComposer />
    </div>
  );
}
