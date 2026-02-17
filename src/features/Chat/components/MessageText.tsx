import { Streamdown } from "streamdown";
import {
  compactTableLeadingBlankLines,
  linkifyWorkspacePaths,
  normalizeMathDelimiters,
  shouldParseIncompleteMarkdown,
  STREAMDOWN_PLUGINS,
  stripOpenClawReplyTags,
  stripTerminalControlSequences,
} from "../utils/markdown";
import { WorkspaceLink } from "./WorkspaceLink";

const STREAMDOWN_COMPONENTS = {
  a: WorkspaceLink,
};

export function MessageText(props: { text: string; isAnimating: boolean }) {
  const { text, isAnimating } = props;
  const normalized = compactTableLeadingBlankLines(
    normalizeMathDelimiters(
      linkifyWorkspacePaths(stripTerminalControlSequences(stripOpenClawReplyTags(text))),
    ),
  );
  const parseIncomplete = isAnimating || shouldParseIncompleteMarkdown(normalized);
  const mode = parseIncomplete ? "streaming" : "static";

  return (
    <div>
      <Streamdown
        plugins={STREAMDOWN_PLUGINS}
        components={STREAMDOWN_COMPONENTS}
        // 流式阶段容错（含不完整 markdown），完成后切换 static，避免多 block 渲染噪音。
        mode={mode}
        isAnimating={isAnimating}
        parseIncompleteMarkdown={parseIncomplete}
        // Make long tokens/URLs wrap instead of expanding the bubble.
        className="min-w-0 max-w-full break-words [overflow-wrap:anywhere] overflow-x-hidden [&_[data-streamdown='table']]:!w-auto [&_[data-streamdown='table']]:min-w-max"
      >
        {normalized}
      </Streamdown>
    </div>
  );
}
