import type { AnchorHTMLAttributes } from "react";
import { FileIcon, FolderOpenIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { ipc } from "@/lib/ipc";
import { cn } from "@/lib/utils";
import { classifyFile, guessMimeType, useWorkspaceFilesStore } from "@/store/workspaceFiles";

export const WORKSPACE_HASH_PREFIX = "#workspace-file=";

function parseWorkspaceHref(href: string | undefined): string | null {
  if (!href) return null;
  if (href.startsWith(WORKSPACE_HASH_PREFIX)) {
    const raw = href.slice(WORKSPACE_HASH_PREFIX.length);
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }

  let raw: string | null = null;
  try {
    const hash = new URL(href, "http://localhost").hash;
    if (hash.startsWith(WORKSPACE_HASH_PREFIX)) {
      raw = hash.slice(WORKSPACE_HASH_PREFIX.length);
    }
  } catch {
    raw = null;
  }
  if (!raw) return null;

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function isDirectory(path: string): boolean {
  return path.endsWith("/") || !path.includes(".");
}

function WorkspaceImageLink(props: { relativePath: string; filename: string }) {
  const { relativePath, filename } = props;
  const openFile = useWorkspaceFilesStore((s) => s.openFile);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ipc.workspace
      .readFileBase64(relativePath)
      .then((res) => {
        if (cancelled) return;
        setSrc(`data:${guessMimeType(filename)};base64,${res.base64}`);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [relativePath, filename]);

  if (error) return <WorkspaceFileChip relativePath={relativePath} filename={filename} />;

  return (
    <button
      type="button"
      className="my-1 inline-block cursor-pointer overflow-hidden rounded-md border transition-shadow hover:shadow-md"
      onClick={() => void openFile(relativePath)}
      title={filename}
    >
      {src ? (
        <img src={src} alt={filename} className="block h-16 w-auto object-contain" />
      ) : (
        <div className="flex h-16 w-24 items-center justify-center bg-muted text-xs text-muted-foreground">
          ...
        </div>
      )}
    </button>
  );
}

function WorkspaceFileChip(props: { relativePath: string; filename: string }) {
  const { relativePath, filename } = props;
  const openFile = useWorkspaceFilesStore((s) => s.openFile);
  const loadFiles = useWorkspaceFilesStore((s) => s.loadFiles);
  const isDir = isDirectory(relativePath);
  const Icon = isDir ? FolderOpenIcon : FileIcon;

  const handleClick = () => {
    if (isDir) {
      void loadFiles(relativePath.replace(/\/$/, ""));
    } else {
      void openFile(relativePath);
    }
  };

  return (
    <button
      type="button"
      className={cn(
        "my-0.5 inline-flex items-center gap-1 rounded-md border px-2 py-0.5",
        "text-xs text-foreground transition-colors hover:bg-muted",
        "cursor-pointer",
      )}
      onClick={handleClick}
      title={relativePath}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{filename}</span>
    </button>
  );
}

export function WorkspaceLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { href, children, ...rest } = props;
  const relativePath = parseWorkspaceHref(href);

  if (!relativePath) {
    return (
      <a href={href} rel="noreferrer" target="_blank" {...rest}>
        {children}
      </a>
    );
  }

  const label = relativePath.replace(/\/$/, "").split("/").pop() ?? relativePath;
  const kind = isDirectory(relativePath) ? "dir" : classifyFile(label);

  if (kind === "image") {
    return <WorkspaceImageLink relativePath={relativePath} filename={label} />;
  }

  return <WorkspaceFileChip relativePath={relativePath} filename={label} />;
}
