import { describe, expect, it } from "vitest";
import { linkifyWorkspacePaths } from "../markdown";

describe("linkifyWorkspacePaths", () => {
  const root = "/Users/fan/.openclaw/workspace";

  it("converts a plain workspace file path to a markdown link", () => {
    const input = `截图在 ${root}/recent_screenshots/shot.png 中`;
    const result = linkifyWorkspacePaths(input);
    expect(result).toBe("截图在 [shot.png](#workspace-file=recent_screenshots/shot.png) 中");
  });

  it("converts a directory path (trailing /) to a markdown link", () => {
    const input = `目录 ${root}/recent_screenshots/ 里`;
    const result = linkifyWorkspacePaths(input);
    expect(result).toBe("目录 [recent_screenshots](#workspace-file=recent_screenshots/) 里");
  });

  it("converts backtick-wrapped paths and strips backticks", () => {
    const input = `路径 \`${root}/recent_screenshots/\` 可点`;
    const result = linkifyWorkspacePaths(input);
    expect(result).toBe("路径 [recent_screenshots](#workspace-file=recent_screenshots/) 可点");
  });

  it("handles multiple paths on different lines", () => {
    const input = `文件: ${root}/a.txt\n另一个: ${root}/dir/b.jpg`;
    const result = linkifyWorkspacePaths(input);
    expect(result).toContain("[a.txt](#workspace-file=a.txt)");
    expect(result).toContain("[b.jpg](#workspace-file=dir/b.jpg)");
  });

  it("does not convert paths inside fenced code blocks", () => {
    const input = `\`\`\`\n${root}/code.ts\n\`\`\``;
    const result = linkifyWorkspacePaths(input);
    expect(result).toBe(input);
  });

  it("does not convert paths already inside markdown links", () => {
    const input = `[myfile](${root}/file.txt)`;
    const result = linkifyWorkspacePaths(input);
    expect(result).toBe(input);
  });

  it("leaves non-workspace paths untouched", () => {
    const input = "路径 /usr/local/bin/node 不变";
    const result = linkifyWorkspacePaths(input);
    expect(result).toBe(input);
  });
});
