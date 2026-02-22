import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface AttributeCardProps {
  icon: React.ReactNode;
  title: string;
  preview?: string;
  fileName?: string;
  onClick: () => void;
}

export function AttributeCard({ icon, title, preview, fileName, onClick }: AttributeCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1.5 rounded-lg border p-3",
        "flex-1 min-w-0 text-left transition-all",
        "hover:border-primary/50 hover:bg-accent/50",
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        {icon}
        <span>{title}</span>
      </div>
      {preview && (
        <span className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
          {preview}
        </span>
      )}
      {fileName && (
        <div className="mt-auto flex items-center gap-0.5 text-[10px] text-muted-foreground/70">
          <span className="font-mono">{fileName}</span>
          <ChevronRight className="size-3" />
        </div>
      )}
    </button>
  );
}
