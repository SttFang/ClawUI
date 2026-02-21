import type { OpenTab } from "@/store/workspaceFiles";
import { guessLanguage } from "@/store/workspaceFiles";
import { MessageText } from "../../components/MessageText";
import { CsvTable } from "./CsvTable";

function isMarkdownLike(name: string): boolean {
  return /\.(md|mdx|markdown)$/i.test(name);
}

function isCsv(name: string): boolean {
  return /\.(csv|tsv)$/i.test(name);
}

function parseCsvRows(text: string, separator: string): string[][] {
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => line.split(separator));
}

export function TextContent({ tab }: { tab: OpenTab }) {
  if (tab.content == null) return null;

  if (isCsv(tab.name)) {
    const sep = /\.tsv$/i.test(tab.name) ? "\t" : ",";
    const rows = parseCsvRows(tab.content, sep);
    return <CsvTable rows={rows} />;
  }

  if (isMarkdownLike(tab.name)) {
    return <MessageText text={tab.content} isAnimating={false} />;
  }

  const lang = guessLanguage(tab.name);
  if (lang) {
    const fenced = `\`\`\`${lang}\n${tab.content}\n\`\`\``;
    return <MessageText text={fenced} isAnimating={false} />;
  }

  return <pre className="whitespace-pre-wrap break-words text-sm font-mono">{tab.content}</pre>;
}
