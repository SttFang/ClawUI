# Workspace File Preview Enhancement Design

Date: 2026-02-20

## Goal

Enhance the workspace file preview panel to support rendering DOCX (fix bugs), PPTX (visual rendering), Excel, video, and images (zoom/pan) in the side panel.

## Current State

| Type | Status | Quality |
|------|--------|---------|
| DOCX | `docx-preview` integrated | High but buggy (black blocks, not filling) |
| PPTX | `jszip` text extraction | Low — text only |
| PDF | `<iframe>` | High |
| Image | `<img>` tag | Medium — no zoom/pan |
| Excel | Not supported | N/A |
| Video | Not supported | N/A |

## Design

### 1. DOCX — Fix Existing Bugs

- Add `.docx-viewer-wrapper` CSS overrides in `index.css` for light/dark theme background
- Remove `max-w-[960px]` constraint from container
- Keep `inWrapper: true` + `breakPages: true` (pagination)

### 2. PPTX — Visual Rendering

- Package: `pptx-preview` (~500KB, npm free)
- Rewrite `OfficePptxContent` to use DOM rendering (similar to DOCX renderAsync pattern)
- Remove `extractPptxSlidesFromDataUrl` and `extractPptxSlideTextFromXml`

### 3. Excel/XLSX — New Support

- Package: `exceljs` (~3MB, MIT, actively maintained)
- Add `"xlsx"` to `OfficePreviewKind`
- New `OfficeXlsxContent` component: parse workbook → sheet tab switching → `<table>` rendering

### 4. Video — New Support

- Native `<video>` tag, zero dependencies
- Add `"video"` to `FileContentKind`
- Add video extensions: `.mp4`, `.webm`, `.mov`, `.ogg`
- Load via `readFileBase64` as data URL

### 5. Image — Interaction Upgrade

- Package: `react-zoom-pan-pinch` (~441KB, zero external deps)
- Wrap `ImageContent` with `TransformWrapper` / `TransformComponent`

## New Dependencies

| Package | Size | Purpose |
|---------|------|---------|
| `pptx-preview` | ~500KB | PPTX visual rendering |
| `exceljs` | ~3MB | XLSX parsing |
| `react-zoom-pan-pinch` | ~441KB | Image zoom/pan |

## Files Changed

| File | Change |
|------|--------|
| `src/index.css` | Add docx-viewer theme CSS |
| `src/features/Chat/panel/officePreview.ts` | Add xlsx classification; remove pptx text extraction |
| `src/features/Chat/panel/WorkspaceFilePanel.tsx` | Fix DOCX, rewrite PPTX, add XLSX/Video, upgrade Image |
| `src/store/workspaceFiles/types.ts` | Add `"video"` to `FileContentKind` |
| `src/store/workspaceFiles/index.ts` | Add video extensions, MIME types |
| `package.json` | Add 3 dependencies |
