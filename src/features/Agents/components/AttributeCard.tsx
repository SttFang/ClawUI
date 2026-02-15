import { cn } from "@/lib/utils";

interface AttributeCardProps {
  icon: React.ReactNode;
  title: string;
  summary: string;
  onClick: () => void;
}

export function AttributeCard({ icon, title, summary, onClick }: AttributeCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border border-dashed p-3",
        "w-[120px] h-[80px] text-left transition-all",
        "hover:border-solid hover:border-primary/50 hover:scale-[1.02]",
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        {icon}
        <span>{title}</span>
      </div>
      <span className="text-xs text-muted-foreground truncate w-full">{summary}</span>
    </button>
  );
}
