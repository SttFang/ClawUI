import { describe, expect, it } from 'vitest'
import { openclawTranscriptToUIMessages } from '../../openclaw/transcript'

describe('openclawTranscriptToUIMessages', () => {
  it('should convert basic text blocks into UIMessage parts', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'm1',
        role: 'assistant',
        content: [{ type: 'text', text: 'hello' }],
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.role).toBe('assistant')
    expect(ui[0]?.parts).toEqual([{ type: 'text', text: 'hello' }])
  })

  it('should keep assistant text for output_text style blocks', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'm2',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'done from tool' }],
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.parts).toEqual([{ type: 'text', text: 'done from tool' }])
  })

  it('should lift toolcall/toolresult blocks into dynamic-tool parts', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'm1',
        role: 'assistant',
        toolCallId: 'tc1',
        content: [
          { type: 'toolcall', name: 'search', arguments: { q: 'claw' } },
          { type: 'toolresult', text: 'ok' },
        ],
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.parts).toEqual([
      {
        type: 'dynamic-tool',
        toolName: 'search',
        toolCallId: 'tc1',
        state: 'output-available',
        input: { q: 'claw' },
        output: 'ok',
        providerExecuted: true,
      },
    ])
  })

  it('should keep fallback message id stable when index shifts', () => {
    const record = {
      role: 'assistant',
      timestamp: 1739232000000,
      content: [{ type: 'text', text: 'same output' }],
    }

    const base = openclawTranscriptToUIMessages([record])[0]?.id
    const shifted = openclawTranscriptToUIMessages([
      { id: 'user-1', role: 'user', content: [{ type: 'text', text: 'hello' }] },
      record,
    ])[1]?.id

    expect(base).toBeTruthy()
    expect(shifted).toBeTruthy()
    expect(shifted).toBe(base)
  })

  it('should disambiguate duplicate direct message ids to avoid UI merge pollution', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'dup-id',
        role: 'assistant',
        content: [{ type: 'text', text: 'first' }],
      },
      {
        id: 'dup-id',
        role: 'assistant',
        content: [{ type: 'text', text: 'second' }],
      },
    ])

    expect(ui).toHaveLength(2)
    expect(ui[0]?.id).toBe('dup-id')
    expect(ui[1]?.id).toBe('dup-id:2')
  })

  it('should disambiguate duplicate fallback ids in one history batch', () => {
    const ts = 1739232000000
    const ui = openclawTranscriptToUIMessages([
      {
        role: 'assistant',
        timestamp: ts,
        content: [{ type: 'text', text: 'same content' }],
      },
      {
        role: 'assistant',
        timestamp: ts,
        content: [{ type: 'text', text: 'same content' }],
      },
    ])

    expect(ui).toHaveLength(2)
    expect(ui[0]?.id).toBeTruthy()
    expect(ui[1]?.id).toBeTruthy()
    expect(ui[1]?.id).not.toBe(ui[0]?.id)
  })

  it('should map toolResult role with result field into dynamic-tool output', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'tool-result-1',
        role: 'toolResult',
        toolCallId: 'tc-res-1',
        toolName: 'exec',
        result: { stdout: 'ok' },
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.role).toBe('assistant')
    expect(ui[0]?.parts).toEqual([
      {
        type: 'dynamic-tool',
        toolName: 'exec',
        toolCallId: 'tc-res-1',
        state: 'output-available',
        input: {},
        output: { stdout: 'ok' },
        providerExecuted: true,
      },
    ])
  })

  it('should extract text from tool_result content blocks', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'm-tool-content',
        role: 'assistant',
        content: [
          { type: 'toolcall', name: 'read', arguments: { path: 'a.txt' } },
          {
            type: 'tool_result',
            content: [
              { type: 'text', text: 'line1' },
              { type: 'text', text: 'line2' },
            ],
          },
        ],
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.parts).toEqual([
      {
        type: 'dynamic-tool',
        toolName: 'read',
        toolCallId: 'm-tool-content',
        state: 'output-available',
        input: { path: 'a.txt' },
        output: 'line1\nline2',
        providerExecuted: true,
      },
    ])
  })

  it('should fallback exec output when tool result has no output payload', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'm-tool-empty',
        role: 'toolResult',
        toolCallId: 'tc-empty',
        toolName: 'exec',
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.parts).toEqual([
      {
        type: 'dynamic-tool',
        toolName: 'exec',
        toolCallId: 'tc-empty',
        state: 'output-available',
        input: {},
        output: 'No output - tool completed successfully.',
        providerExecuted: true,
      },
    ])
  })

  it('should preserve both text and tool result parts in one message', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'm-tool-mixed',
        role: 'toolResult',
        toolCallId: 'tc-mixed',
        toolName: 'exec',
        content: [
          { type: 'text', text: '执行完成：' },
          { type: 'tool_result_error', text: 'permission denied' },
        ],
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.parts).toEqual([
      { type: 'text', text: '执行完成：' },
      {
        type: 'dynamic-tool',
        toolName: 'exec',
        toolCallId: 'tc-mixed',
        state: 'output-available',
        input: {},
        output: 'permission denied',
        providerExecuted: true,
      },
    ])
  })

  it('should suppress redundant tool receipt text when tool output exists', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'm-tool-redundant',
        role: 'assistant',
        content: [
          { type: 'text', text: 'System: Exec finished (code 0)' },
          { type: 'tool_result', text: 'System: Exec finished (code 0)' },
        ],
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.parts).toEqual([
      {
        type: 'dynamic-tool',
        toolName: 'tool',
        toolCallId: 'm-tool-redundant',
        state: 'output-available',
        input: {},
        output: 'System: Exec finished (code 0)',
        providerExecuted: true,
      },
    ])
  })

  it('should use runId as toolCallId fallback when tool id is missing', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        role: 'toolResult',
        runId: 'run-fallback-id',
        toolName: 'exec',
        result: 'done',
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.parts).toEqual([
      {
        type: 'dynamic-tool',
        toolName: 'exec',
        toolCallId: 'run-fallback-id',
        state: 'output-available',
        input: {},
        output: 'done',
        providerExecuted: true,
      },
    ])
  })

  it('should filter user messages from internal_system provenance', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'u-internal',
        role: 'user',
        content: [{ type: 'text', text: 'internal tool handoff' }],
        inputProvenance: { kind: 'internal_system' },
      },
      {
        id: 'a1',
        role: 'assistant',
        content: [{ type: 'text', text: '继续执行完成。' }],
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.id).toBe('a1')
    expect(ui[0]?.role).toBe('assistant')
  })

  it('should normalize toolCallId with call/fc suffix to call id', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'tool-fc-1',
        role: 'toolResult',
        toolCallId: 'call_abc123|fc_987',
        toolName: 'read',
        result: 'ok',
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.parts).toEqual([
      {
        type: 'dynamic-tool',
        toolName: 'read',
        toolCallId: 'call_abc123',
        state: 'output-available',
        input: {},
        output: 'ok',
        providerExecuted: true,
      },
    ])
  })

  it('should keep normal toolCallId unchanged when no call/fc suffix exists', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'tool-normal-1',
        role: 'toolResult',
        toolCallId: 'tc_read_1',
        toolName: 'read',
        result: 'ok',
      },
    ])

    expect(ui).toHaveLength(1)
    const part = ui[0]?.parts[0]
    expect(part && part.type === 'dynamic-tool' ? part.toolCallId : '').toBe('tc_read_1')
  })

  it('should collapse adjacent synthetic input/read and real output/read into one output card', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'assistant:1771052284748:h56r6u:175',
        role: 'assistant',
        toolName: 'read',
        content: [{ type: 'toolcall', name: 'read', arguments: { path: '/tmp/1.png' } }],
      },
      {
        id: 'call_I0juQg9HZ0gB68z8TTSMdvQy|fc_0c57b44d',
        role: 'toolResult',
        toolCallId: 'call_I0juQg9HZ0gB68z8TTSMdvQy|fc_0c57b44d',
        toolName: 'read',
        content: [{ type: 'tool_result', text: 'Read image file [image/png]' }],
        input: { path: '/tmp/1.png' },
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.parts).toEqual([
      {
        type: 'dynamic-tool',
        toolName: 'read',
        toolCallId: 'call_I0juQg9HZ0gB68z8TTSMdvQy',
        state: 'output-available',
        input: { path: '/tmp/1.png' },
        output: 'Read image file [image/png]',
        providerExecuted: true,
      },
    ])
  })

  it('should skip tool receipt user messages (System: Exec finished)', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'a1',
        role: 'assistant',
        toolCallId: 'tc1',
        content: [{ type: 'toolcall', name: 'exec', arguments: { command: 'ls' } }],
      },
      {
        id: 'u-receipt',
        role: 'user',
        content: [{ type: 'text', text: 'System: Exec finished (code 0)' }],
      },
      {
        id: 'tr1',
        role: 'toolResult',
        toolCallId: 'tc1',
        toolName: 'exec',
        result: 'file.txt',
      },
    ])

    // receipt user message should be filtered; tool messages should merge
    expect(ui.every(m => m.role === 'assistant')).toBe(true)
    expect(ui.flatMap(m => m.parts).some(p => p.type === 'text' && p.text.includes('System:'))).toBe(false)
  })

  it('should skip empty text user messages', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'u-empty',
        role: 'user',
        content: [{ type: 'text', text: '   ' }],
      },
      {
        id: 'a1',
        role: 'assistant',
        content: [{ type: 'text', text: 'hello' }],
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.id).toBe('a1')
  })

  it('should merge adjacent pure-tool assistant messages', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'tool-1',
        role: 'toolResult',
        toolCallId: 'tc1',
        toolName: 'read',
        result: 'file1',
      },
      {
        id: 'tool-2',
        role: 'toolResult',
        toolCallId: 'tc2',
        toolName: 'read',
        result: 'file2',
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.parts).toHaveLength(2)
    const parts = ui[0]?.parts.filter(p => p.type === 'dynamic-tool')
    expect(parts).toHaveLength(2)
  })

  it('should not merge assistant messages when one contains text', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'tool-1',
        role: 'toolResult',
        toolCallId: 'tc1',
        toolName: 'read',
        result: 'file1',
      },
      {
        id: 'a-text',
        role: 'assistant',
        content: [{ type: 'text', text: 'Let me explain...' }],
      },
    ])

    expect(ui).toHaveLength(2)
  })

  it('should not merge tool messages separated by real user messages', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'tool-1',
        role: 'toolResult',
        toolCallId: 'tc1',
        toolName: 'read',
        result: 'file1',
      },
      {
        id: 'u-real',
        role: 'user',
        content: [{ type: 'text', text: 'Now read another file' }],
      },
      {
        id: 'tool-2',
        role: 'toolResult',
        toolCallId: 'tc2',
        toolName: 'read',
        result: 'file2',
      },
    ])

    expect(ui).toHaveLength(3)
    expect(ui[1]?.role).toBe('user')
  })

  it('should collapse input→output with different ids when one is synthetic (state progression)', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'assistant:1771052284748:h56r6u:175',
        role: 'assistant',
        toolName: 'exec',
        content: [{ type: 'toolcall', name: 'exec', arguments: { command: 'ls' } }],
      },
      {
        id: 'call_abc123',
        role: 'toolResult',
        toolCallId: 'call_abc123',
        toolName: 'exec',
        result: 'file.txt',
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.parts).toHaveLength(1)
    const part = ui[0]?.parts[0]
    expect(part?.type).toBe('dynamic-tool')
    if (part?.type === 'dynamic-tool') {
      expect(part.state).toBe('output-available')
      expect(part.output).toBe('file.txt')
      // Input from the earlier input-available message must be preserved
      expect(part.input).toEqual({ command: 'ls' })
    }
  })

  it('should preserve real user messages even with empty content blocks', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'u-real',
        role: 'user',
        content: '帮我看看这个目录',
      },
      {
        id: 'a1',
        role: 'assistant',
        content: [{ type: 'text', text: 'OK' }],
      },
    ])

    expect(ui).toHaveLength(2)
    expect(ui[0]?.role).toBe('user')
    expect(ui[0]?.parts).toEqual([{ type: 'text', text: '帮我看看这个目录' }])
  })
})
