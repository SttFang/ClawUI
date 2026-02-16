import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMessageAssembler } from '../message-assembler'
import { createApprovalRecovery } from '../approval-recovery'
import type { UIMessageChunk } from 'ai'

function makeCallbacks() {
  const chunks: UIMessageChunk[] = []
  return {
    chunks,
    enqueue: (chunk: UIMessageChunk) => { chunks.push(chunk) },
  }
}

describe('MessageAssembler', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('emits start-step + text-start + text-delta on first text', () => {
    const approval = createApprovalRecovery(() => 0)
    const cb = makeCallbacks()
    const asm = createMessageAssembler(approval, cb)

    asm.updateTextWithSnapshot('hello')
    expect(cb.chunks).toEqual([
      { type: 'start-step' },
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', delta: 'hello' },
    ])
    expect(asm.currentTextLength).toBe(5)
  })

  it('computes suffix delta on subsequent snapshots', () => {
    const approval = createApprovalRecovery(() => 0)
    const cb = makeCallbacks()
    const asm = createMessageAssembler(approval, cb)

    asm.updateTextWithSnapshot('hello')
    cb.chunks.length = 0
    asm.updateTextWithSnapshot('hello world')
    expect(cb.chunks).toEqual([
      { type: 'text-delta', id: 'text-1', delta: ' world' },
    ])
  })

  it('ignores non-monotonic snapshots', () => {
    const approval = createApprovalRecovery(() => 0)
    const cb = makeCallbacks()
    const asm = createMessageAssembler(approval, cb)

    asm.updateTextWithSnapshot('hello world')
    cb.chunks.length = 0
    asm.updateTextWithSnapshot('hi')
    expect(cb.chunks).toEqual([])
  })

  it('closes text part on tool split and creates new part after', () => {
    const approval = createApprovalRecovery(() => 0)
    const cb = makeCallbacks()
    const asm = createMessageAssembler(approval, cb)

    asm.updateTextWithSnapshot('before')
    cb.chunks.length = 0
    asm.closeTextForToolSplit()
    expect(cb.chunks).toEqual([
      { type: 'text-end', id: 'text-1' },
    ])

    cb.chunks.length = 0
    asm.updateTextWithSnapshot('before after')
    expect(cb.chunks[0]).toEqual({ type: 'text-start', id: 'text-2' })
    expect(asm.currentTextPartId).toBe('text-2')
  })

  it('lockToChatSource cancels pending assistant fallback', () => {
    const approval = createApprovalRecovery(() => 0)
    const cb = makeCallbacks()
    const asm = createMessageAssembler(approval, cb)

    asm.handleAssistantText('fallback text', false)
    asm.lockToChatSource()
    vi.advanceTimersByTime(300)
    expect(cb.chunks).toEqual([])
  })

  it('assistant fallback emits text after 300ms', () => {
    const approval = createApprovalRecovery(() => 0)
    const cb = makeCallbacks()
    const asm = createMessageAssembler(approval, cb)

    asm.handleAssistantText('fallback', false)
    expect(cb.chunks).toEqual([])

    vi.advanceTimersByTime(300)
    expect(cb.chunks).toContainEqual({ type: 'text-delta', id: 'text-1', delta: 'fallback' })
  })

  it('assistant fallback is suppressed if chat event arrived', () => {
    const approval = createApprovalRecovery(() => 0)
    const cb = makeCallbacks()
    const asm = createMessageAssembler(approval, cb)

    asm.handleAssistantText('fallback', true)
    vi.advanceTimersByTime(300)
    // hasSeenChatEvent=true → no text emitted
    expect(cb.chunks).toEqual([])
  })

  it('dispose clears assistant fallback timer', () => {
    const approval = createApprovalRecovery(() => 0)
    const cb = makeCallbacks()
    const asm = createMessageAssembler(approval, cb)

    asm.handleAssistantText('will be cancelled', false)
    asm.dispose()
    vi.advanceTimersByTime(300)
    expect(cb.chunks).toEqual([])
  })

  it('hasActiveTextPart tracks text part state', () => {
    const approval = createApprovalRecovery(() => 0)
    const cb = makeCallbacks()
    const asm = createMessageAssembler(approval, cb)

    expect(asm.hasActiveTextPart).toBe(false)
    asm.ensureTextStarted()
    expect(asm.hasActiveTextPart).toBe(true)
  })
})
