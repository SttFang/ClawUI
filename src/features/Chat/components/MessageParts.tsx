import type { UIMessage } from 'ai'
import { ToolEventCard } from '@/components/A2UI'
import { MessageText } from './MessageText'

export function MessageParts(props: { message: UIMessage; streaming: boolean }) {
  const { message, streaming } = props

  return (
    <div className="space-y-3">
      {message.parts.map((part, index) => {
        if (part.type === 'step-start') return null
        if (part.type === 'text') {
          if (!part.text.trim()) return null
          return <MessageText key={index} text={part.text} isAnimating={streaming && part.state === 'streaming'} />
        }
        if (part.type === 'dynamic-tool') {
          return <ToolEventCard key={index} part={part} />
        }
        // lifecycle 默认不占消息流位置（后续可放到独立的“运行状态/调试”面板）。
        if (part.type === 'data-openclaw-lifecycle') return null
        // v1: ignore other parts (files, reasoning, sources, data parts, static tools).
        return null
      })}
    </div>
  )
}

