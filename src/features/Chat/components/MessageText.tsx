import { Streamdown } from "streamdown";
import {
  normalizeMathDelimiters,
  STREAMDOWN_PLUGINS,
  stripOpenClawReplyTags,
  stripTerminalControlSequences,
} from "../utils/markdown";

export function MessageText(props: { text: string; isAnimating: boolean }) {
  const { text, isAnimating } = props;
  const normalized = normalizeMathDelimiters(
    stripTerminalControlSequences(stripOpenClawReplyTags(text)),
  );
  return (
    <Streamdown
      plugins={STREAMDOWN_PLUGINS}
      // Keep a single render path to avoid a layout "jump" when streaming completes.
      mode="streaming"
      isAnimating={isAnimating}
      parseIncompleteMarkdown={isAnimating}
      // Make long tokens/URLs wrap instead of expanding the bubble.
      className="w-fit max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
    >
      {normalized}
    </Streamdown>
  );
}
