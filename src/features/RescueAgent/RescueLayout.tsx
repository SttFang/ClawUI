import type { ReactNode } from "react";
import { useEffect } from "react";
import { initRescueListener } from "@/store/rescue";
import { RescueAgentPanel } from "./RescueAgentPanel";
import { RescueAgentTrigger } from "./RescueAgentTrigger";

/** Wraps a page with side-by-side rescue panel support. */
export function RescueLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    initRescueListener();
  }, []);

  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1">{children}</div>
      <RescueAgentPanel />
      <RescueAgentTrigger />
    </div>
  );
}
