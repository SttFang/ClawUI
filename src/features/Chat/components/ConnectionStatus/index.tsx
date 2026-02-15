import { Popover, PopoverTrigger, PopoverContent } from "@clawui/ui";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useChatStore, selectWsConnected } from "@/store/chat";
import { useGatewayStore, selectGatewayStatus } from "@/store/gateway";
import {
  useGatewayActivityStore,
  selectLastTickAt,
  selectTickIntervalMs,
} from "@/store/gatewayActivity";
import { ActivityPanel } from "./ActivityPanel";
import { useTickHealth } from "./useTickHealth";

const TICK_HEALTH_COLOR = {
  unknown: "bg-green-500",
  healthy: "bg-green-500",
  delayed: "bg-yellow-500",
  timeout: "bg-red-500",
} as const;

const TICK_HEALTH_LABEL = {
  delayed: "connection.heartbeatDelayed",
  timeout: "connection.heartbeatTimeout",
} as const;

/**
 * ConnectionStatus — 顶边栏右上角的连接状态指示器
 *
 * 状态优先级：
 *   gateway error  → 红点 "Error"
 *   gateway stopped → 灰点 "Offline"
 *   gateway starting → 黄点闪烁 "Starting"
 *   ws connected + tick healthy → 绿点 "Connected"
 *   ws connected + tick delayed → 黄点 "心跳延迟"
 *   ws connected + tick timeout → 红点 "心跳超时"
 *   ws disconnected → 橙点 "Connecting"
 */
export function ConnectionStatus() {
  const { t } = useTranslation("common");
  const gatewayStatus = useGatewayStore(selectGatewayStatus);
  const wsConnected = useChatStore(selectWsConnected);
  const syncWsStatus = useChatStore((s) => s.syncWsStatus);
  const lastTickAt = useGatewayActivityStore(selectLastTickAt);
  const tickIntervalMs = useGatewayActivityStore(selectTickIntervalMs);
  const tickHealth = useTickHealth(lastTickAt, tickIntervalMs);

  useEffect(() => {
    syncWsStatus();
  }, [gatewayStatus, syncWsStatus]);

  const { color, labelKey } = getStatusDisplay(gatewayStatus, wsConnected, tickHealth);
  const label = t(labelKey);
  const showPopover = gatewayStatus === "running";

  const dot = (
    <div
      className={cn(
        "titlebar-no-drag flex items-center gap-1.5 px-3",
        showPopover && "cursor-pointer",
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className={cn("h-2 w-2 rounded-full", color)} aria-hidden="true" />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );

  if (!showPopover) return dot;

  return (
    <Popover>
      <PopoverTrigger asChild>{dot}</PopoverTrigger>
      <PopoverContent className="w-80">
        <ActivityPanel />
      </PopoverContent>
    </Popover>
  );
}

function getStatusDisplay(
  gateway: string,
  wsConnected: boolean,
  tickHealth: "unknown" | "healthy" | "delayed" | "timeout",
): { color: string; labelKey: string } {
  if (gateway === "error") {
    return { color: "bg-red-500", labelKey: "connection.error" };
  }
  if (gateway === "stopped") {
    return { color: "bg-gray-400", labelKey: "connection.offline" };
  }
  if (gateway === "starting") {
    return { color: "bg-yellow-500 animate-pulse", labelKey: "connection.starting" };
  }
  // gateway === 'running'
  if (wsConnected) {
    if (tickHealth === "delayed") {
      return { color: TICK_HEALTH_COLOR.delayed, labelKey: TICK_HEALTH_LABEL.delayed };
    }
    if (tickHealth === "timeout") {
      return { color: TICK_HEALTH_COLOR.timeout, labelKey: TICK_HEALTH_LABEL.timeout };
    }
    return { color: TICK_HEALTH_COLOR[tickHealth], labelKey: "connection.connected" };
  }
  return { color: "bg-orange-400 animate-pulse", labelKey: "connection.connecting" };
}
