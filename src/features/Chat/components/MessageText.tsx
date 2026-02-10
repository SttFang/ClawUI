import { Streamdown } from 'streamdown'
import { normalizeMathDelimiters, STREAMDOWN_PLUGINS, stripOpenClawReplyTags } from '../utils/markdown'

export function MessageText(props: { text: string; isAnimating: boolean }) {
  const { text, isAnimating } = props
  const normalized = normalizeMathDelimiters(stripOpenClawReplyTags(text))
  return (
    <Streamdown
      plugins={STREAMDOWN_PLUGINS}
      mode={isAnimating ? 'streaming' : 'static'}
      isAnimating={isAnimating}
      parseIncompleteMarkdown
      // Make long tokens/URLs wrap instead of expanding the bubble.
      className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
    >
      {normalized}
    </Streamdown>
  )
}
