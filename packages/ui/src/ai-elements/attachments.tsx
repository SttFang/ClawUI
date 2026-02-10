import { cn } from "../utils";

export type AttachmentItem = {
  id: string;
  filename: string;
  mediaType?: string;
  url?: string;
};

export function Attachments(props: {
  items: AttachmentItem[];
  onRemove?: (id: string) => void;
  className?: string;
  removeLabel?: string;
}) {
  const { items, onRemove, className, removeLabel = "Remove attachment" } = props;

  if (!items.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "flex min-w-0 items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 text-xs",
            "max-w-full",
          )}
        >
          <div className="min-w-0">
            <div className="truncate font-medium">{item.filename}</div>
            {item.mediaType ? (
              <div className="truncate text-[11px] text-muted-foreground">{item.mediaType}</div>
            ) : null}
          </div>

          {onRemove ? (
            <button
              type="button"
              className={cn(
                "ml-auto shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground",
                "hover:bg-accent hover:text-foreground",
              )}
              aria-label={removeLabel}
              onClick={() => onRemove(item.id)}
            >
              ×
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
