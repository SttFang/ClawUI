import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRunBinding, type RunBindingContext } from '../run-binding'
import { createApprovalRecovery } from '../approval-recovery'
import type { OpenClawChatEvent } from '../types'

function makeChatEvent(overrides: Partial<OpenClawChatEvent> = {}): OpenClawChatEvent {
  return {
    runId: 'run-1',
    sessionKey: 'session-1',
    seq: 1,
    state: 'delta',
    message: { role: 'assistant', content: [{ type: 'text', text: 'hi' }] },
    ...overrides,
  } as OpenClawChatEvent
}

function makeCtx(overrides?: Partial<RunBindingContext>): RunBindingContext {
  return {
    currentTextLength: () => 0,
    isContinuationSnapshot: () => false,
    isFinished: () => false,
    onDeferredChatEvent: vi.fn(),
    ...overrides,
  }
}

describe('RunBinding', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('accepts events matching clientRunId', () => {
    const approval = createApprovalRecovery(() => 0)
    const ctx = makeCtx()
    const binding = createRunBinding(approval, ctx)
    binding.setClientRunId('run-1')

    const result = binding.processChatRunId(makeChatEvent({ runId: 'run-1' }))
    expect(result).toBe('accept')
  })

  it('defers events with unknown runId', () => {
    const approval = createApprovalRecovery(() => 0)
    const ctx = makeCtx()
    const binding = createRunBinding(approval, ctx)
    binding.setClientRunId('run-1')

    const result = binding.processChatRunId(makeChatEvent({ runId: 'run-other', state: 'delta' }))
    expect(result).toBe('defer')
  })

  it('fires deferred event after grace period', () => {
    const approval = createApprovalRecovery(() => 0)
    const onDeferred = vi.fn()
    const ctx = makeCtx({ onDeferredChatEvent: onDeferred })
    const binding = createRunBinding(approval, ctx)
    binding.setClientRunId('run-1')

    const evt = makeChatEvent({ runId: 'run-alias', state: 'delta' })
    binding.processChatRunId(evt)
    expect(onDeferred).not.toHaveBeenCalled()

    vi.advanceTimersByTime(250)
    expect(onDeferred).toHaveBeenCalledWith(evt)
  })

  it('does not fire deferred event if finished', () => {
    const approval = createApprovalRecovery(() => 0)
    const onDeferred = vi.fn()
    const ctx = makeCtx({ onDeferredChatEvent: onDeferred, isFinished: () => true })
    const binding = createRunBinding(approval, ctx)
    binding.setClientRunId('run-1')

    binding.processChatRunId(makeChatEvent({ runId: 'run-alias', state: 'final' }))
    vi.advanceTimersByTime(250)
    expect(onDeferred).not.toHaveBeenCalled()
  })

  it('accepts agent events matching clientRunId', () => {
    const approval = createApprovalRecovery(() => 0)
    const ctx = makeCtx()
    const binding = createRunBinding(approval, ctx)
    binding.setClientRunId('run-1')

    const accepted = binding.processAgentRunId({
      rid: 'run-1',
      stream: 'lifecycle',
      phase: 'start',
    })
    expect(accepted).toBe(true)
  })

  it('binds agent runId on lifecycle start', () => {
    const approval = createApprovalRecovery(() => 0)
    const ctx = makeCtx()
    const binding = createRunBinding(approval, ctx)
    binding.setClientRunId('run-1')

    binding.processAgentRunId({ rid: 'agent-run-1', stream: 'lifecycle', phase: 'start', seq: 1 })
    expect(binding.isCurrentAgentRun('agent-run-1')).toBe(true)
  })

  it('rejects stale agent events', () => {
    const approval = createApprovalRecovery(() => 0)
    const ctx = makeCtx()
    const binding = createRunBinding(approval, ctx)
    binding.setStreamStartedAt(10_000)

    expect(binding.isStaleAgentEvent(5_000)).toBe(true)
    expect(binding.isStaleAgentEvent(9_500)).toBe(false)
    expect(binding.isStaleAgentEvent('not-a-number')).toBe(false)
  })

  it('marks client chat seen', () => {
    const approval = createApprovalRecovery(() => 0)
    const ctx = makeCtx()
    const binding = createRunBinding(approval, ctx)

    expect(binding.hasSeenClientChatEvent).toBe(false)
    binding.markClientChatSeen()
    expect(binding.hasSeenClientChatEvent).toBe(true)
  })

  it('dispose clears pending alias timer', () => {
    const approval = createApprovalRecovery(() => 0)
    const onDeferred = vi.fn()
    const ctx = makeCtx({ onDeferredChatEvent: onDeferred })
    const binding = createRunBinding(approval, ctx)
    binding.setClientRunId('run-1')

    binding.processChatRunId(makeChatEvent({ runId: 'run-alias', state: 'final' }))
    binding.dispose()
    vi.advanceTimersByTime(300)
    expect(onDeferred).not.toHaveBeenCalled()
  })
})
