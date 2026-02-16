import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApprovalRecovery } from '../approval-recovery'

describe('ApprovalRecovery', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('initially reports no recent activity', () => {
    const recovery = createApprovalRecovery(() => 0)
    expect(recovery.hasRecentApprovalActivity()).toBe(false)
    expect(recovery.hasRecentToolTerminalActivity()).toBe(false)
  })

  it('reports recent approval activity after note', () => {
    const recovery = createApprovalRecovery(() => 0)
    recovery.noteApprovalActivity()
    expect(recovery.hasRecentApprovalActivity()).toBe(true)
  })

  it('approval activity expires after window', () => {
    const recovery = createApprovalRecovery(() => 0)
    recovery.noteApprovalActivity()
    vi.advanceTimersByTime(120_001)
    expect(recovery.hasRecentApprovalActivity()).toBe(false)
  })

  it('reports recent tool terminal activity after note', () => {
    const recovery = createApprovalRecovery(() => 0)
    recovery.noteToolTerminalActivity()
    expect(recovery.hasRecentToolTerminalActivity()).toBe(true)
  })

  it('tool terminal activity expires after window', () => {
    const recovery = createApprovalRecovery(() => 0)
    recovery.noteToolTerminalActivity()
    vi.advanceTimersByTime(120_001)
    expect(recovery.hasRecentToolTerminalActivity()).toBe(false)
  })

  it('ignores stale createdAtMs relative to stream start', () => {
    const recovery = createApprovalRecovery(() => 10_000)
    recovery.noteApprovalActivity(5_000) // older than stream start - 1000
    expect(recovery.hasRecentApprovalActivity()).toBe(false)
  })

  it('accepts createdAtMs within stream start tolerance', () => {
    const recovery = createApprovalRecovery(() => 10_000)
    recovery.noteApprovalActivity(9_500) // within 1s of stream start
    expect(recovery.hasRecentApprovalActivity()).toBe(true)
  })
})
