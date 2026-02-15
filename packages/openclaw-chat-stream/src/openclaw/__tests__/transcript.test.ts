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

  // --- metadata prefix stripping ---

  it('should strip Conversation info + timestamp prefix from user message', () => {
    const raw = `Conversation info (untrusted metadata): {"chat_id":123}\n[Mon 2026-02-10 14:30 GMT+8] 帮我看看日志`
    const ui = openclawTranscriptToUIMessages([
      { id: 'u-meta', role: 'user', content: raw },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.role).toBe('user')
    expect(ui[0]?.parts).toEqual([{ type: 'text', text: '帮我看看日志' }])
  })

  it('should strip multi-section metadata prefix keeping only real message', () => {
    const raw = [
      'Conversation info (untrusted metadata): {"id":1}',
      'Sender (untrusted metadata): {"name":"test"}',
      '[Tue 2026-02-11 09:00 GMT+8] 真实消息内容',
    ].join('\n')
    const ui = openclawTranscriptToUIMessages([
      { id: 'u-multi-meta', role: 'user', content: raw },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.parts).toEqual([{ type: 'text', text: '真实消息内容' }])
  })

  it('should preserve metadata-like text without timestamp (safe fallback)', () => {
    const raw = 'Conversation info (untrusted metadata): {"id":1}\nno timestamp here'
    const ui = openclawTranscriptToUIMessages([
      { id: 'u-no-ts', role: 'user', content: raw },
    ])

    expect(ui).toHaveLength(1)
    // Without timestamp, stripUserMetadataPrefix returns original text
    expect(ui[0]?.parts[0]?.type).toBe('text')
    const text = ui[0]?.parts[0]?.type === 'text' ? ui[0].parts[0].text : ''
    expect(text).toContain('Conversation info')
  })

  it('should not strip prefix from normal user messages', () => {
    const ui = openclawTranscriptToUIMessages([
      { id: 'u-normal', role: 'user', content: '普通消息不变' },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.parts).toEqual([{ type: 'text', text: '普通消息不变' }])
  })

  // --- user message disappearing regression ---

  it('should NOT filter user message containing "exec finished" substring (startsWith fix)', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'u-exec-sub',
        role: 'user',
        content: [{ type: 'text', text: 'The exec finished running successfully' }],
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.role).toBe('user')
    expect(ui[0]?.parts[0]?.type === 'text' ? ui[0].parts[0].text : '').toContain('exec finished')
  })

  it('should NOT filter user message containing "approval required" substring', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'u-approval-sub',
        role: 'user',
        content: [{ type: 'text', text: 'I need approval required for this task' }],
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.role).toBe('user')
  })

  it('should fallback to record.text when content is undefined for user messages', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'u-fallback',
        role: 'user',
        text: 'hello from text field',
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.role).toBe('user')
    expect(ui[0]?.parts).toEqual([{ type: 'text', text: 'hello from text field' }])
  })

  // --- tool input preservation ---

  it('should preserve input from toolResult record when toolcall has no arguments', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'tr-with-input',
        role: 'toolResult',
        toolCallId: 'tc-inp-1',
        toolName: 'exec',
        input: { command: 'ls' },
        result: 'file.txt',
      },
    ])

    expect(ui).toHaveLength(1)
    const part = ui[0]?.parts[0]
    expect(part?.type).toBe('dynamic-tool')
    if (part?.type === 'dynamic-tool') {
      expect(part.input).toEqual({ command: 'ls' })
      expect(part.output).toBe('file.txt')
    }
  })

  it('should merge input→output with different real IDs when output input is empty', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'call_AAA',
        role: 'assistant',
        toolCallId: 'call_AAA',
        toolName: 'read',
        content: [{ type: 'toolcall', name: 'read', arguments: { path: '/tmp/a.txt' } }],
      },
      {
        id: 'call_BBB',
        role: 'toolResult',
        toolCallId: 'call_BBB',
        toolName: 'read',
        result: 'file contents',
      },
    ])

    expect(ui).toHaveLength(1)
    const part = ui[0]?.parts[0]
    expect(part?.type).toBe('dynamic-tool')
    if (part?.type === 'dynamic-tool') {
      expect(part.state).toBe('output-available')
      expect(part.input).toEqual({ path: '/tmp/a.txt' })
      expect(part.output).toBe('file contents')
    }
  })

  it('should not crash on standalone toolResult without input', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'tr-no-input',
        role: 'toolResult',
        toolCallId: 'tc-no-inp',
        toolName: 'cron',
        result: 'done',
      },
    ])

    expect(ui).toHaveLength(1)
    const part = ui[0]?.parts[0]
    expect(part?.type).toBe('dynamic-tool')
    if (part?.type === 'dynamic-tool') {
      expect(part.input).toEqual({})
      expect(part.output).toBe('done')
    }
  })

  it('should not incorrectly merge interleaved batch exec calls', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'a-input-A',
        role: 'assistant',
        toolCallId: 'call_A',
        toolName: 'exec',
        content: [{ type: 'toolcall', name: 'exec', arguments: { command: 'ls' } }],
      },
      {
        id: 'a-input-B',
        role: 'assistant',
        toolCallId: 'call_B',
        toolName: 'exec',
        content: [{ type: 'toolcall', name: 'exec', arguments: { command: 'git status' } }],
      },
      {
        id: 'tr-output-A',
        role: 'toolResult',
        toolCallId: 'call_A',
        toolName: 'exec',
        result: 'file.txt',
      },
      {
        id: 'tr-output-B',
        role: 'toolResult',
        toolCallId: 'call_B',
        toolName: 'exec',
        result: 'On branch master',
      },
    ])

    // Should produce exactly 2 tool parts (A and B), each with correct input+output
    const toolParts = ui.flatMap(m => m.parts).filter(p => p.type === 'dynamic-tool')
    expect(toolParts).toHaveLength(2)

    const partA = toolParts.find(
      p => p.type === 'dynamic-tool' && p.toolCallId === 'call_A'
    )
    const partB = toolParts.find(
      p => p.type === 'dynamic-tool' && p.toolCallId === 'call_B'
    )

    expect(partA).toBeDefined()
    expect(partB).toBeDefined()
    if (partA?.type === 'dynamic-tool') {
      expect(partA.input).toEqual({ command: 'ls' })
      expect(partA.output).toBe('file.txt')
    }
    if (partB?.type === 'dynamic-tool') {
      expect(partB.input).toEqual({ command: 'git status' })
      expect(partB.output).toBe('On branch master')
    }
  })
})
