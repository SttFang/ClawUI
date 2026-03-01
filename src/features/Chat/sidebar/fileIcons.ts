import type { LucideIcon } from "lucide-react";
import {
  File,
  FileCode2,
  FileJson2,
  FileSpreadsheet,
  FileText,
  Folder,
  Globe,
  Image,
  Palette,
  Settings,
  Terminal,
  Video,
} from "lucide-react";

const extMap: Record<string, LucideIcon> = {
  ts: FileCode2,
  tsx: FileCode2,
  js: FileCode2,
  jsx: FileCode2,
  py: FileCode2,
  rs: FileCode2,
  go: FileCode2,
  java: FileCode2,
  c: FileCode2,
  cpp: FileCode2,
  rb: FileCode2,
  lua: FileCode2,
  json: FileJson2,
  md: FileText,
  txt: FileText,
  log: FileText,
  html: Globe,
  htm: Globe,
  xml: Globe,
  css: Palette,
  scss: Palette,
  less: Palette,
  png: Image,
  jpg: Image,
  gif: Image,
  webp: Image,
  svg: Image,
  ico: Image,
  bmp: Image,
  mp4: Video,
  webm: Video,
  mov: Video,
  pdf: FileSpreadsheet,
  doc: FileSpreadsheet,
  docx: FileSpreadsheet,
  ppt: FileSpreadsheet,
  pptx: FileSpreadsheet,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  sh: Terminal,
  bash: Terminal,
  zsh: Terminal,
  yaml: Settings,
  yml: Settings,
  toml: Settings,
};

export function getFileIcon(name: string, isDirectory: boolean): LucideIcon {
  if (isDirectory) return Folder;
  const dot = name.lastIndexOf(".");
  if (dot === -1) return File;
  const ext = name.slice(dot + 1).toLowerCase();
  return extMap[ext] ?? File;
}
