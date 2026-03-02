import { Wand2 } from "lucide-react";
import { useMemo } from "react";
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

const SKILL_REQUEST_RE = /<skill_request>\s*([\s\S]*?)\s*<\/skill_request>/g;

/** Parse skill names like「name」from skill_request body text. */
function parseSkillNames(body: string): string[] {
  const re = /「([^」]+)」/g;
  const names: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m[1]) names.push(m[1]);
  }
  return names;
}

interface SkillRequestBlock {
  skills: string[];
}

interface ParsedSegment {
  kind: "text" | "skill_request";
  content: string;
  data?: SkillRequestBlock;
}

function parseSkillRequests(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(SKILL_REQUEST_RE)) {
    const start = match.index;
    if (start > lastIndex) {
      segments.push({ kind: "text", content: text.slice(lastIndex, start) });
    }
    const body = match[1] ?? "";
    segments.push({
      kind: "skill_request",
      content: body,
      data: { skills: parseSkillNames(body) },
    });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: "text", content: text.slice(lastIndex) });
  }

  return segments;
}

function SkillRequestBadge(props: { data: SkillRequestBlock }) {
  const { skills } = props.data;
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs text-primary">
      <Wand2 className="size-3.5 shrink-0" />
      <span className="font-medium">Skills</span>
      {skills.map((name) => (
        <span key={name} className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium">
          {name}
        </span>
      ))}
    </div>
  );
}

function MarkdownBlock(props: { text: string; isAnimating: boolean }) {
  const { text, isAnimating } = props;
  const normalized = compactTableLeadingBlankLines(
    normalizeMathDelimiters(
      linkifyWorkspacePaths(stripTerminalControlSequences(stripOpenClawReplyTags(text))),
    ),
  );
  if (!normalized.trim()) return null;

  const parseIncomplete = isAnimating || shouldParseIncompleteMarkdown(normalized);
  const mode = parseIncomplete ? "streaming" : "static";

  return (
    <Streamdown
      plugins={STREAMDOWN_PLUGINS}
      components={STREAMDOWN_COMPONENTS}
      mode={mode}
      isAnimating={isAnimating}
      parseIncompleteMarkdown={parseIncomplete}
      className="min-w-0 max-w-full break-words [overflow-wrap:anywhere] overflow-x-hidden [&_[data-streamdown='table']]:!w-auto [&_[data-streamdown='table']]:min-w-max"
    >
      {normalized}
    </Streamdown>
  );
}

export function MessageText(props: { text: string; isAnimating: boolean }) {
  const { text, isAnimating } = props;

  const segments = useMemo(() => parseSkillRequests(text), [text]);
  const hasSkillRequests = segments.some((s) => s.kind === "skill_request");

  // Fast path: no skill_request blocks
  if (!hasSkillRequests) {
    return (
      <div>
        <MarkdownBlock text={text} isAnimating={isAnimating} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {segments.map((seg, i) =>
        seg.kind === "skill_request" && seg.data ? (
          <SkillRequestBadge key={i} data={seg.data} />
        ) : (
          <MarkdownBlock key={i} text={seg.content} isAnimating={isAnimating} />
        ),
      )}
    </div>
  );
}
