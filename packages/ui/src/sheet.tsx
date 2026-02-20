import { X } from "lucide-react";
import * as React from "react";
import { cn } from "./utils";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };

    if (open) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" onClick={() => onOpenChange(false)} />
      {children}
    </div>
  );
}

type SheetSide = "right" | "left";

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: SheetSide;
  onClose?: () => void;
}

const sideStyles: Record<SheetSide, string> = {
  right: "inset-y-0 right-0 animate-in slide-in-from-right",
  left: "inset-y-0 left-0 animate-in slide-in-from-left",
};

export function SheetContent({
  className,
  children,
  side = "right",
  onClose,
  ...props
}: SheetContentProps) {
  return (
    <div
      className={cn(
        "fixed bg-background shadow-lg border-l flex flex-col w-full sm:max-w-md",
        sideStyles[side],
        className,
      )}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-4 top-3 p-1 rounded-sm opacity-70 hover:opacity-100 transition-opacity z-10"
          aria-label="Close sheet"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {children}
    </div>
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1 p-4 pb-2 border-b", className)} {...props} />;
}

export function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-base font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}
