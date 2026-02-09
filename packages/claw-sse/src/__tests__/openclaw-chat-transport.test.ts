import { describe, it, expect, vi } from 'vitest'
import type { UIMessage } from 'ai'
import { createOpenClawChatTransport, type GatewayEventFrame } from '../openclaw-chat-transport'

function createUserMessage(text: string): UIMessage {
  return {
    id: 'u1',
    role: 'user',
    parts: [{ type: 'text', text }],
  }
}

async function readNext<T>(reader: ReadableStreamDefaultReader<T>): Promise<T> {
  const { value, done } = await reader.read()
  if (done) throw new Error('stream closed unexpectedly')
  return value
}

describe('createOpenClawChatTransport', () => {
  it('should emit suffix deltas from OpenClaw chat snapshot events', async () => {
    let handler: ((frame: GatewayEventFrame) => void) | null = null

    const transport = createOpenClawChatTransport({
      sessionKey: 's1',
      adapter: {
        onGatewayEvent(h) {
          handler = h
          return () => {
            handler = null
          }
        },
        async sendChat() {
          return 'run1'
        },
      },
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'c1',
      messageId: undefined,
      messages: [createUserMessage('hi')],
      abortSignal: undefined,
    })

    const reader = stream.getReader()

    expect((await readNext(reader)).type).toBe('start')
    expect((await readNext(reader)).type).toBe('start-step')
    expect((await readNext(reader)).type).toBe('text-start')

    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'run1',
        sessionKey: 's1',
        seq: 1,
        state: 'delta',
        message: { content: [{ type: 'text', text: 'hello' }] },
      },
    })

    const d1 = await readNext(reader)
    expect(d1).toEqual({ type: 'text-delta', id: 'text-1', delta: 'hello' })

    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'run1',
        sessionKey: 's1',
        seq: 2,
        state: 'delta',
        message: { content: [{ type: 'text', text: 'hello world' }] },
      },
    })

    const d2 = await readNext(reader)
    expect(d2).toEqual({ type: 'text-delta', id: 'text-1', delta: ' world' })

    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'run1',
        sessionKey: 's1',
        seq: 3,
        state: 'final',
        message: { content: [{ type: 'text', text: 'hello world' }] },
      },
    })

    expect((await readNext(reader)).type).toBe('text-end')
    expect((await readNext(reader)).type).toBe('finish-step')
    expect((await readNext(reader)).type).toBe('finish')

    const last = await reader.read()
    expect(last.done).toBe(true)
  })

  it('should map OpenClaw tool events into AI SDK tool chunks', async () => {
    vi.useFakeTimers()
    let handler: ((frame: GatewayEventFrame) => void) | null = null

    const transport = createOpenClawChatTransport({
      sessionKey: 's1',
      adapter: {
        onGatewayEvent(h) {
          handler = h
          return () => {
            handler = null
          }
        },
        async sendChat() {
          return 'run1'
        },
      },
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'c1',
      messageId: undefined,
      messages: [createUserMessage('run a tool')],
      abortSignal: undefined,
    })
    const reader = stream.getReader()

    expect((await readNext(reader)).type).toBe('start')
    expect((await readNext(reader)).type).toBe('start-step')
    expect((await readNext(reader)).type).toBe('text-start')

    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run1',
        seq: 10,
        stream: 'tool',
        ts: Date.now(),
        data: {
          phase: 'start',
          name: 'search',
          toolCallId: 'tc1',
          args: { q: 'claw' },
          meta: 'Search',
        },
      },
    })

    const toolStart = await readNext(reader)
    expect(toolStart).toMatchObject({
      type: 'tool-input-available',
      toolCallId: 'tc1',
      toolName: 'search',
      providerExecuted: true,
      dynamic: true,
      input: { q: 'claw' },
    })

    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run1',
        seq: 11,
        stream: 'tool',
        ts: Date.now(),
        data: {
          phase: 'result',
          name: 'search',
          toolCallId: 'tc1',
          result: { ok: true },
          isError: false,
        },
      },
    })

    const toolResult = await readNext(reader)
    expect(toolResult).toMatchObject({
      type: 'tool-output-available',
      toolCallId: 'tc1',
      providerExecuted: true,
      dynamic: true,
      output: { ok: true },
    })

    // Finish via lifecycle as a safety net.
    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run1',
        seq: 12,
        stream: 'lifecycle',
        ts: Date.now(),
        data: { phase: 'end' },
      },
    })

    // lifecycle finish is delayed to avoid truncation (chat.final usually arrives after lifecycle end).
    await vi.advanceTimersByTimeAsync(300)

    // Drain until finished.
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value && typeof value === 'object' && (value as { type?: unknown }).type === 'finish') {
        break
      }
    }

    vi.useRealTimers()
  })

  it('should wait for chat.final if lifecycle end arrives first (avoid truncation)', async () => {
    let handler: ((frame: GatewayEventFrame) => void) | null = null

    const transport = createOpenClawChatTransport({
      sessionKey: 's1',
      adapter: {
        onGatewayEvent(h) {
          handler = h
          return () => {
            handler = null
          }
        },
        async sendChat() {
          return 'run1'
        },
      },
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'c1',
      messageId: undefined,
      messages: [createUserMessage('hi')],
      abortSignal: undefined,
    })

    const reader = stream.getReader()

    expect((await readNext(reader)).type).toBe('start')
    expect((await readNext(reader)).type).toBe('start-step')
    expect((await readNext(reader)).type).toBe('text-start')

    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'run1',
        sessionKey: 's1',
        seq: 1,
        state: 'delta',
        message: { content: [{ type: 'text', text: '你好 Steven，' }] },
      },
    })

    const d1 = await readNext(reader)
    expect(d1).toEqual({ type: 'text-delta', id: 'text-1', delta: '你好 Steven，' })

    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run1',
        seq: 1,
        stream: 'lifecycle',
        ts: Date.now(),
        data: { phase: 'end' },
      },
    })

    // If we finished immediately here, we'd miss the trailing chat.final payload (truncation bug).
    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'run1',
        sessionKey: 's1',
        seq: 2,
        state: 'final',
        message: { content: [{ type: 'text', text: '你好 Steven，我在。今晚想让我帮你做点什么？' }] },
      },
    })

    const d2 = await readNext(reader)
    expect(d2).toEqual({ type: 'text-delta', id: 'text-1', delta: '我在。今晚想让我帮你做点什么？' })

    expect((await readNext(reader)).type).toBe('text-end')
    expect((await readNext(reader)).type).toBe('finish-step')
    expect((await readNext(reader)).type).toBe('finish')
  })

  it('should finish when agent lifecycle ends even without chat.final (delayed fallback)', async () => {
    vi.useFakeTimers()
    let handler: ((frame: GatewayEventFrame) => void) | null = null

    const transport = createOpenClawChatTransport({
      sessionKey: 's1',
      adapter: {
        onGatewayEvent(h) {
          handler = h
          return () => {
            handler = null
          }
        },
        async sendChat() {
          return 'run1'
        },
      },
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'c1',
      messageId: undefined,
      messages: [createUserMessage('hi')],
      abortSignal: undefined,
    })

    const reader = stream.getReader()

    expect((await readNext(reader)).type).toBe('start')
    expect((await readNext(reader)).type).toBe('start-step')
    expect((await readNext(reader)).type).toBe('text-start')

    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run1',
        seq: 1,
        stream: 'lifecycle',
        ts: Date.now(),
        data: { phase: 'end' },
      },
    })

    await vi.advanceTimersByTimeAsync(300)

    expect((await readNext(reader)).type).toBe('text-end')
    expect((await readNext(reader)).type).toBe('finish-step')
    expect((await readNext(reader)).type).toBe('finish')

    vi.useRealTimers()
  })
})
