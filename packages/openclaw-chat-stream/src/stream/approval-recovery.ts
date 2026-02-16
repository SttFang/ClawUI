const APPROVAL_ALIAS_WINDOW_MS = 120_000
const DIVERGENT_ASSISTANT_APPEND_WINDOW_MS = 120_000

export interface ApprovalRecovery {
  noteApprovalActivity(createdAtMs?: unknown): void
  noteToolTerminalActivity(): void
  hasRecentApprovalActivity(): boolean
  hasRecentToolTerminalActivity(): boolean
}

export function createApprovalRecovery(getStreamStartedAt: () => number): ApprovalRecovery {
  let lastApprovalActivityAt = 0
  let lastToolTerminalActivityAt = 0

  return {
    noteApprovalActivity(createdAtMs?: unknown) {
      const startedAt = getStreamStartedAt()
      if (typeof createdAtMs === 'number' && startedAt > 0 && createdAtMs + 1000 < startedAt) {
        return
      }
      lastApprovalActivityAt = Date.now()
    },

    noteToolTerminalActivity() {
      lastToolTerminalActivityAt = Date.now()
    },

    hasRecentApprovalActivity() {
      if (!lastApprovalActivityAt) return false
      return Date.now() - lastApprovalActivityAt <= APPROVAL_ALIAS_WINDOW_MS
    },

    hasRecentToolTerminalActivity() {
      if (!lastToolTerminalActivityAt) return false
      return Date.now() - lastToolTerminalActivityAt <= DIVERGENT_ASSISTANT_APPEND_WINDOW_MS
    },
  }
}
