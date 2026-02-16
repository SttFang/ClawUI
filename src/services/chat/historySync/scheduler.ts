/**
 * HistoryRefreshScheduler — 统一历史刷新调度层
 *
 * 将散布在 useOpenClawHistorySync 中的多个定时器和触发逻辑收口到
 * 一个纯逻辑对象中（非 React hook），方便测试和维护。
 *
 * 信号优先级：critical (0ms) > high (合并窗口) > normal (节流) > low (heartbeat 回退)
 */

export type SignalPriority = "critical" | "high" | "normal" | "low";

export interface RefreshSignal {
  priority: SignalPriority;
  force: boolean;
  reason: string;
  allowRetry?: boolean;
}

export interface SchedulerCallbacks {
  executeRefresh(options: {
    force: boolean;
    reason: string;
    allowRetry: boolean;
  }): Promise<boolean>;
  extendRecoveryWindow(durationMs: number): void;
  clearRunningForSession(): void;
  resetHeartbeatBackoff(): void;
  shouldRefreshOnHeartbeat(): boolean;
  isRecoveryActive(): boolean;
}

const HIGH_MERGE_WINDOW_MS = 100;

const APPROVAL_RECOVERY_WINDOW_MS = 120_000;

export const APPROVAL_FOLLOWUP_DELAYS_MS = [
  800, 2_000, 5_000, 10_000, 15_000, 30_000, 45_000, 60_000,
] as const;
const FORCE_FOLLOWUP_THRESHOLD_MS = 10_000;

export interface HistoryRefreshScheduler {
  emit(signal: RefreshSignal): void;
  emitApprovalRecovery(): void;
  dispose(): void;
}

export function createHistoryRefreshScheduler(cb: SchedulerCallbacks): HistoryRefreshScheduler {
  let highMergeTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingHighSignal: RefreshSignal | null = null;
  const approvalFollowupTimers: ReturnType<typeof setTimeout>[] = [];

  const clearHighMerge = () => {
    if (highMergeTimer) {
      clearTimeout(highMergeTimer);
      highMergeTimer = null;
    }
    pendingHighSignal = null;
  };

  const clearApprovalFollowups = () => {
    for (const timer of approvalFollowupTimers) clearTimeout(timer);
    approvalFollowupTimers.length = 0;
  };

  const execute = (signal: RefreshSignal) => {
    void cb.executeRefresh({
      force: signal.force,
      reason: signal.reason,
      allowRetry: signal.allowRetry !== false,
    });
  };

  const mergeSignals = (existing: RefreshSignal, incoming: RefreshSignal): RefreshSignal => ({
    priority: existing.priority,
    force: existing.force || incoming.force,
    reason:
      existing.reason === incoming.reason
        ? existing.reason
        : `${existing.reason}+${incoming.reason}`,
    allowRetry: existing.allowRetry !== false || incoming.allowRetry !== false,
  });

  const emit = (signal: RefreshSignal) => {
    if (signal.priority === "critical") {
      clearHighMerge();
      execute(signal);
      return;
    }

    if (signal.priority === "high") {
      if (pendingHighSignal) {
        pendingHighSignal = mergeSignals(pendingHighSignal, signal);
        return;
      }
      pendingHighSignal = signal;
      highMergeTimer = setTimeout(() => {
        highMergeTimer = null;
        const merged = pendingHighSignal;
        pendingHighSignal = null;
        if (merged) execute(merged);
      }, HIGH_MERGE_WINDOW_MS);
      return;
    }

    // normal / low — execute directly (throttling is handled by useHistoryRefresh)
    execute(signal);
  };

  const emitApprovalRecovery = () => {
    cb.extendRecoveryWindow(APPROVAL_RECOVERY_WINDOW_MS);
    cb.resetHeartbeatBackoff();
    clearApprovalFollowups();

    emit({
      priority: "critical",
      force: true,
      reason: "approval-resolved-immediate",
      allowRetry: true,
    });

    for (const delayMs of APPROVAL_FOLLOWUP_DELAYS_MS) {
      const timer = setTimeout(() => {
        emit({
          priority: "high",
          force: delayMs <= FORCE_FOLLOWUP_THRESHOLD_MS,
          reason: `approval-resolved-followup-${delayMs}`,
          allowRetry: true,
        });
      }, delayMs);
      approvalFollowupTimers.push(timer);
    }
  };

  return {
    emit,
    emitApprovalRecovery,
    dispose() {
      clearHighMerge();
      clearApprovalFollowups();
    },
  };
}

// --- Signal mapping helpers ---

export function mapHeartbeatToSignal(
  heartbeatReason: string,
  shouldRefresh: boolean,
): RefreshSignal | null {
  if (heartbeatReason === "exec-event") {
    return {
      priority: "high",
      force: true,
      reason: "heartbeat-exec-event",
      allowRetry: true,
    };
  }
  if (shouldRefresh) {
    return {
      priority: "low",
      force: false,
      reason: "heartbeat",
      allowRetry: false,
    };
  }
  return null;
}

export function mapChatStateToSignal(state: string): RefreshSignal | null {
  if (state === "final" || state === "aborted" || state === "error") {
    return {
      priority: "critical",
      force: true,
      reason: `chat-${state}`,
      allowRetry: true,
    };
  }
  return null;
}

export function mapLifecyclePhaseToSignal(phase: string): RefreshSignal | null {
  if (phase === "end" || phase === "error") {
    return {
      priority: "critical",
      force: true,
      reason: `lifecycle-${phase}`,
      allowRetry: true,
    };
  }
  return null;
}

export function mapApprovalRequestedToSignal(): RefreshSignal {
  return {
    priority: "normal",
    force: false,
    reason: "approval-requested",
    allowRetry: true,
  };
}

export function mapApprovalResolvedRawToSignal(): RefreshSignal {
  return {
    priority: "critical",
    force: true,
    reason: "approval-resolved-raw",
    allowRetry: true,
  };
}
