import { cn } from "@clawui/ui";
import { Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRescueStore, selectIsRescueOpen, selectRescueGatewayStatus } from "@/store/rescue";

const statusDot: Record<string, string> = {
  running: "bg-green-500",
  starting: "bg-amber-500 animate-pulse",
  stopped: "bg-gray-400",
  error: "bg-red-500",
};

export function RescueAgentTrigger() {
  const { t } = useTranslation("common");
  const toggle = useRescueStore((s) => s.toggle);
  const isOpen = useRescueStore(selectIsRescueOpen);
  const status = useRescueStore(selectRescueGatewayStatus);

  if (isOpen) return null;

  return (
    <button
      onClick={toggle}
      title={t("rescue.trigger")}
      className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
    >
      <Wrench className="h-5 w-5" />
      <span
        className={cn(
          "absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background",
          statusDot[status] ?? statusDot.stopped,
        )}
      />
    </button>
  );
}
