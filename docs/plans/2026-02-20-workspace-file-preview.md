# Workspace File Preview Enhancement — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix DOCX rendering bugs and add support for PPTX visual rendering, Excel preview, video playback, and image zoom/pan in the workspace file panel.

**Architecture:** Extend the existing `WorkspaceFilePanel` component tree. Each file type gets its own `*Content` component, dispatched by the `OfficeContent` router or the main panel switch. Store layer adds `"video"` to `FileContentKind`; office sub-classification adds `"xlsx"`. All rendering stays client-side, no backend changes.

**Tech Stack:** docx-preview (existing), pptx-preview (new), exceljs (new), react-zoom-pan-pinch (new), native `<video>` element.

**Note on innerHTML usage:** The existing `docx-preview` and new `pptx-preview` libraries internally manage DOM rendering within sandboxed containers. The `host.innerHTML = ""` calls are only used to clear these containers on cleanup/re-render, not to inject untrusted content. This is the standard usage pattern documented by both libraries.

---

## Task 1: Install new dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install packages**

Run:
```bash
pnpm add pptx-preview exceljs react-zoom-pan-pinch
```

**Step 2: Verify installation**

Run:
```bash
bun run type-check
```
Expected: PASS (no type errors — packages include their own types or are untyped)

**Step 3: Commit**

```bash
scripts/committer "📦 chore: add pptx-preview, exceljs, react-zoom-pan-pinch" package.json pnpm-lock.yaml
```

---

## Task 2: Fix DOCX rendering bugs (black blocks + not filling)

**Files:**
- Modify: `src/index.css` (add docx-viewer CSS overrides)
- Modify: `src/features/Chat/panel/WorkspaceFilePanel.tsx:163-169` (remove max-w constraint)

**Step 1: Add docx-viewer CSS overrides to `src/index.css`**

在 `@layer components` 块末尾（`a[href^="#workspace-file="]` 规则之后）添加：

```css
  /* docx-preview wrapper: adapt to light/dark theme */
  .docx-viewer-wrapper {
    background: var(--background) !important;
    padding: 16px !important;
  }

  .docx-viewer-wrapper > section.docx-viewer {
    background: white !important;
    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
    margin: 0 auto 16px auto;
  }
```

这样在暗色主题下，wrapper 背景跟随 `--background`，文档页面本身保持白色并加阴影（类似 Word 的分页效果）。

**Step 2: Remove max-w constraint from OfficeDocxContent**

文件: `src/features/Chat/panel/WorkspaceFilePanel.tsx`

将第 166 行：
```tsx
        <div ref={containerRef} className="mx-auto max-w-[960px]" />
```
改为：
```tsx
        <div ref={containerRef} />
```

docx-preview 自身会根据文档的 page width 生成正确的 section 宽度，不需要外部约束。

**Step 3: Verify visually**

Run: `pnpm dev`，打开一个 .docx 文件，确认：
- 无黑块（暗色/亮色主题都检查）
- 页面宽度由文档本身决定，居中显示
- 分页效果保留

**Step 4: Commit**

```bash
scripts/committer "🐛 fix(preview): fix docx black blocks and width constraint" src/index.css src/features/Chat/panel/WorkspaceFilePanel.tsx
```

---

## Task 3: Add video support — store layer

**Files:**
- Modify: `src/store/workspaceFiles/types.ts:4` (add `"video"` to `FileContentKind`)
- Modify: `src/store/workspaceFiles/index.ts:11-13,23-38` (add VIDEO_EXTS, MIME entries)
- Modify: `src/store/workspaceFiles/__tests__/store.test.ts` (add video test cases)

**Step 1: Write failing tests**

在 `src/store/workspaceFiles/__tests__/store.test.ts` 中添加：

```typescript
// 在 classifyFile describe 中增加
it("classifies video files", () => {
  expect(classifyFile("clip.mp4")).toBe("video");
  expect(classifyFile("demo.webm")).toBe("video");
  expect(classifyFile("screen.mov")).toBe("video");
  expect(classifyFile("audio.ogg")).toBe("video");
});

// 在 guessMimeType describe 中增加
it("returns correct MIME types for video files", () => {
  expect(guessMimeType("a.mp4")).toBe("video/mp4");
  expect(guessMimeType("b.webm")).toBe("video/webm");
  expect(guessMimeType("c.mov")).toBe("video/quicktime");
  expect(guessMimeType("d.ogg")).toBe("video/ogg");
});
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run --silent='passed-only' 'src/store/workspaceFiles/__tests__/store.test.ts'`
Expected: FAIL — `"video"` not in `FileContentKind`, no video MIME entries

**Step 3: Implement — types.ts**

文件: `src/store/workspaceFiles/types.ts:4`

将：
```typescript
export type FileContentKind = "text" | "image" | "html" | "office";
```
改为：
```typescript
export type FileContentKind = "text" | "image" | "html" | "office" | "video";
```

**Step 4: Implement — index.ts**

文件: `src/store/workspaceFiles/index.ts`

在第 11 行 `IMAGE_EXTS` 之后添加：
```typescript
const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov", ".ogg", ".ogv"]);
```

在 `classifyFile` 函数中，在 `if (IMAGE_EXTS.has(ext))` 之后添加：
```typescript
  if (VIDEO_EXTS.has(ext)) return "video";
```

在 `MIME_MAP` 中添加：
```typescript
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".ogg": "video/ogg",
  ".ogv": "video/ogg",
```

在 `openFile` action 中，修改 base64 读取条件（第 173 行）：
```typescript
if (kind === "image" || kind === "office" || kind === "video") {
```

**Step 5: Run tests**

Run: `bunx vitest run --silent='passed-only' 'src/store/workspaceFiles/__tests__/store.test.ts'`
Expected: PASS

**Step 6: Type check**

Run: `bun run type-check`
Expected: PASS

**Step 7: Commit**

```bash
scripts/committer "✨ feat(store): add video file type classification" src/store/workspaceFiles/types.ts src/store/workspaceFiles/index.ts src/store/workspaceFiles/__tests__/store.test.ts
```

---

## Task 4: Add video support — UI layer

**Files:**
- Modify: `src/features/Chat/panel/WorkspaceFilePanel.tsx` (add VideoContent, add route)

**Step 1: Add VideoContent component**

在 `ImageContent` 组件之后添加：

```tsx
function VideoContent({ tab }: { tab: OpenTab }) {
  if (!tab.content) return null;
  return (
    <div className="flex h-full items-center justify-center bg-black p-4">
      <video
        controls
        className="max-h-full max-w-full"
        src={tab.content}
      >
        <track kind="captions" />
      </video>
    </div>
  );
}
```

**Step 2: Add routing in main panel switch**

在 `WorkspaceFilePanel` 的渲染逻辑中（第 330 行附近），在 `activeTab.kind === "image"` 分支之后添加 video 分支：

完整的条件链变为：
```tsx
{activeTab.kind === "image" ? (
  <ImageContent tab={activeTab} />
) : activeTab.kind === "video" ? (
  <VideoContent tab={activeTab} />
) : activeTab.kind === "html" ? (
  <HtmlContent tab={activeTab} />
) : activeTab.kind === "office" ? (
  <OfficeContent tab={activeTab} />
) : (
  <ScrollArea className="h-full">
    <div className="p-4">
      <TextContent tab={activeTab} />
    </div>
  </ScrollArea>
)}
```

**Step 3: Type check**

Run: `bun run type-check`
Expected: PASS

**Step 4: Visual verify**

Run: `pnpm dev`，打开一个 .mp4 文件，确认视频播放器正常显示。

**Step 5: Commit**

```bash
scripts/committer "✨ feat(preview): add video playback support" src/features/Chat/panel/WorkspaceFilePanel.tsx
```

---

## Task 5: Upgrade image preview with zoom/pan

**Files:**
- Modify: `src/features/Chat/panel/WorkspaceFilePanel.tsx` (upgrade ImageContent)

**Step 1: Rewrite ImageContent**

将现有 `ImageContent` 替换为：

```tsx
function ImageContent({ tab }: { tab: OpenTab }) {
  if (!tab.content) return null;
  return (
    <div className="flex h-full items-center justify-center overflow-hidden">
      <TransformWrapper
        initialScale={1}
        minScale={0.1}
        maxScale={10}
        centerOnInit
      >
        <TransformComponent
          wrapperClass="!w-full !h-full"
          contentClass="!w-full !h-full !flex !items-center !justify-center"
        >
          <img
            src={tab.content}
            alt={tab.name}
            className="max-h-full max-w-full object-contain"
          />
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
```

**Step 2: Add import**

在文件顶部添加：
```tsx
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
```

**Step 3: Type check**

Run: `bun run type-check`
Expected: PASS

**Step 4: Visual verify**

Run: `pnpm dev`，打开一张图片，确认：
- 滚轮缩放正常
- 拖拽平移正常
- 触摸板 pinch-to-zoom 正常（macOS）

**Step 5: Commit**

```bash
scripts/committer "✨ feat(preview): add image zoom/pan with react-zoom-pan-pinch" src/features/Chat/panel/WorkspaceFilePanel.tsx
```

---

## Task 6: Add Excel/XLSX support — officePreview classification

**Files:**
- Modify: `src/features/Chat/panel/officePreview.ts:3,10-16` (add xlsx kind)
- Modify: `src/features/Chat/panel/__tests__/officePreview.test.ts` (add xlsx test)

**Step 1: Write failing test**

在 `officePreview.test.ts` 的 `classifies office preview kind` 测试中添加：

```typescript
expect(classifyOfficePreview("data.xlsx")).toBe("xlsx");
expect(classifyOfficePreview("budget.XLSX")).toBe("xlsx");
expect(classifyOfficePreview("legacy.xls")).toBe("unsupported"); // 只有 xlsx 支持解析
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run --silent='passed-only' 'src/features/Chat/panel/__tests__/officePreview.test.ts'`
Expected: FAIL — `"xlsx"` not in `OfficePreviewKind`

**Step 3: Implement**

文件: `src/features/Chat/panel/officePreview.ts`

将第 3 行：
```typescript
export type OfficePreviewKind = "pdf" | "docx" | "pptx" | "unsupported";
```
改为：
```typescript
export type OfficePreviewKind = "pdf" | "docx" | "pptx" | "xlsx" | "unsupported";
```

在 `classifyOfficePreview` 中，在 `if (ext === ".pptx") return "pptx";` 之后添加：
```typescript
  if (ext === ".xlsx") return "xlsx";
```

**Step 4: Run tests**

Run: `bunx vitest run --silent='passed-only' 'src/features/Chat/panel/__tests__/officePreview.test.ts'`
Expected: PASS

**Step 5: Commit**

```bash
scripts/committer "✨ feat(preview): add xlsx classification to officePreview" src/features/Chat/panel/officePreview.ts src/features/Chat/panel/__tests__/officePreview.test.ts
```

---

## Task 7: Add Excel/XLSX support — UI rendering

**Files:**
- Modify: `src/features/Chat/panel/WorkspaceFilePanel.tsx` (add OfficeXlsxContent, update OfficeContent router)
- Modify: `src/locales/default/chat.ts` (add i18n keys)
- Modify: `src/locales/en-US/chat.ts` (add i18n keys)

**Step 1: Add i18n keys**

在 `src/locales/default/chat.ts` 的 `workspaceFiles` 对象中添加：
```typescript
    sheet: "工作表",
    sheetEmpty: "该工作表为空。",
```

在 `src/locales/en-US/chat.ts` 的 `workspaceFiles` 对象中添加：
```typescript
    sheet: "Sheet",
    sheetEmpty: "This sheet is empty.",
```

**Step 2: Add OfficeXlsxContent component**

在 `WorkspaceFilePanel.tsx` 的 `OfficePptxContent` 之后添加：

```tsx
function OfficeXlsxContent({ tab }: { tab: OpenTab }) {
  const { t } = useTranslation("chat");
  const [sheets, setSheets] = useState<{ name: string; rows: string[][] }[] | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tab.content) return;

    let cancelled = false;
    setSheets(null);
    setActiveSheet(0);
    setError(null);

    void (async () => {
      try {
        const { dataUrlToUint8Array } = await import("./officePreview");
        const ExcelJS = await import("exceljs");
        const bytes = dataUrlToUint8Array(tab.content!);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(bytes.buffer as ArrayBuffer);

        if (cancelled) return;

        const parsed: { name: string; rows: string[][] }[] = [];
        workbook.eachSheet((worksheet) => {
          const rows: string[][] = [];
          worksheet.eachRow((row) => {
            const cells: string[] = [];
            row.eachCell({ includeEmpty: true }, (cell) => {
              cells.push(cell.text ?? "");
            });
            rows.push(cells);
          });
          parsed.push({ name: worksheet.name, rows });
        });
        setSheets(parsed);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => { cancelled = true; };
  }, [tab.content]);

  if (error) {
    return (
      <p className="p-4 text-sm text-destructive">
        {t("workspaceFiles.loadError")}: {error}
      </p>
    );
  }

  if (sheets == null) {
    return <p className="p-4 text-sm text-muted-foreground">{t("workspaceFiles.officeLoading")}</p>;
  }

  const current = sheets[activeSheet];

  return (
    <div className="flex h-full flex-col">
      {sheets.length > 1 && (
        <div className="flex gap-0 overflow-x-auto border-b">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              type="button"
              className={cn(
                "shrink-0 px-3 py-1.5 text-xs cursor-pointer select-none border-r",
                i === activeSheet
                  ? "bg-background text-foreground font-medium"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
              onClick={() => setActiveSheet(i)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        {current && current.rows.length > 0 ? (
          <table className="w-full border-collapse text-xs">
            <tbody>
              {current.rows.map((row, ri) => (
                <tr key={ri} className={ri === 0 ? "bg-muted/50 font-medium" : "border-t"}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border-r px-2 py-1 whitespace-nowrap">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">{t("workspaceFiles.sheetEmpty")}</p>
        )}
      </ScrollArea>
    </div>
  );
}
```

**Step 3: Update OfficeContent router**

在 `OfficeContent` 组件中，在 `if (kind === "pptx")` 之后添加：
```tsx
  if (kind === "xlsx") {
    return <OfficeXlsxContent tab={tab} />;
  }
```

**Step 4: Type check**

Run: `bun run type-check`
Expected: PASS

**Step 5: Visual verify**

Run: `pnpm dev`，打开一个 .xlsx 文件，确认：
- 表格数据正确渲染
- 多 sheet 时底部有 tab 切换
- 空 sheet 显示提示文案

**Step 6: Commit**

```bash
scripts/committer "✨ feat(preview): add Excel/XLSX preview with exceljs" src/features/Chat/panel/WorkspaceFilePanel.tsx src/locales/default/chat.ts src/locales/en-US/chat.ts
```

---

## Task 8: Upgrade PPTX to visual rendering

**Files:**
- Modify: `src/features/Chat/panel/WorkspaceFilePanel.tsx` (rewrite OfficePptxContent)
- Modify: `src/features/Chat/panel/officePreview.ts` (remove pptx text extraction)
- Modify: `src/features/Chat/panel/__tests__/officePreview.test.ts` (remove pptx XML test)
- Modify: `src/index.css` (add pptx-preview CSS overrides)

**Step 1: Add pptx-preview CSS overrides to `src/index.css`**

在 `@layer components` 中 docx-viewer 规则之后添加：

```css
  /* pptx-preview: adapt to light/dark theme */
  #pptx-preview-wrapper {
    background: var(--background) !important;
  }
```

**Step 2: Rewrite OfficePptxContent**

将现有的 `OfficePptxContent`（第 172-233 行）替换为：

```tsx
function OfficePptxContent({ tab }: { tab: OpenTab }) {
  const { t } = useTranslation("chat");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tab.content || !containerRef.current) return;

    let cancelled = false;
    const host = containerRef.current;
    host.textContent = "";
    setError(null);

    void (async () => {
      try {
        const [pptxPreview, { dataUrlToUint8Array }] = await Promise.all([
          import("pptx-preview"),
          import("./officePreview"),
        ]);
        if (cancelled) return;
        const bytes = dataUrlToUint8Array(tab.content!);
        await pptxPreview.default(bytes, {
          container: host,
          slideMode: "scroll",
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
      host.textContent = "";
    };
  }, [tab.content]);

  if (error) {
    return (
      <p className="p-4 text-sm text-destructive">
        {t("workspaceFiles.loadError")}: {error}
      </p>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <div ref={containerRef} />
      </div>
    </ScrollArea>
  );
}
```

> **注意**：`pptx-preview` 的 API 需要在实现时确认。上面是基于文档的预期调用方式。如果 API 不同（例如导出名称不是 default），在实现时根据实际 TS 类型调整。可以先 `console.log(await import("pptx-preview"))` 检查导出结构。

**Step 3: Clean up officePreview.ts**

从 `src/features/Chat/panel/officePreview.ts` 中移除不再需要的函数：
- `extractPptxSlideTextFromXml`（第 44-56 行）
- `extractPptxSlidesFromDataUrl`（第 58-77 行）

**Step 4: Clean up test**

从 `src/features/Chat/panel/__tests__/officePreview.test.ts` 中：
- 移除 import 中的 `extractPptxSlideTextFromXml`
- 移除对应的 test case（第 27-49 行）

**Step 5: Run tests**

Run: `bunx vitest run --silent='passed-only' 'src/features/Chat/panel/__tests__/officePreview.test.ts'`
Expected: PASS

**Step 6: Type check**

Run: `bun run type-check`
Expected: PASS

**Step 7: Commit**

```bash
scripts/committer "✨ feat(preview): upgrade PPTX to visual rendering with pptx-preview" src/features/Chat/panel/WorkspaceFilePanel.tsx src/features/Chat/panel/officePreview.ts src/features/Chat/panel/__tests__/officePreview.test.ts src/index.css
```

---

## Task 9: Final gate — lint + format + type-check

**Step 1: Type check**

Run: `bun run type-check`
Expected: PASS

**Step 2: Lint**

Run: `pnpm lint`
Expected: PASS (or only pre-existing warnings)

**Step 3: Format check**

Run: `pnpm format:check`
If FAIL: Run `pnpm format` then `pnpm format:check` again.
Expected: PASS

**Step 4: Run all related tests**

Run:
```bash
bunx vitest run --silent='passed-only' 'src/store/workspaceFiles/__tests__/store.test.ts'
bunx vitest run --silent='passed-only' 'src/features/Chat/panel/__tests__/officePreview.test.ts'
```
Expected: Both PASS

**Step 5: If format was fixed, commit**

```bash
scripts/committer "💄 style: format" <changed files>
```

---

## Task Dependency Graph

```
Task 1 (deps install)
  ├── Task 2 (DOCX fix) — independent
  ├── Task 3 (video store) → Task 4 (video UI)
  ├── Task 5 (image upgrade) — independent
  ├── Task 6 (xlsx classification) → Task 7 (xlsx UI)
  └── Task 8 (PPTX upgrade) — independent
Task 9 (final gate) — after all above
```

Tasks 2, 3, 5, 6, 8 can run in parallel after Task 1.
