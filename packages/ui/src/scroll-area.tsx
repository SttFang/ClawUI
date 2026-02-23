import * as React from "react";
import { cn } from "./utils";

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "vertical" | "horizontal" | "both";
  ref?: React.Ref<HTMLDivElement>;
}

function ScrollArea({
  className,
  children,
  orientation = "vertical",
  ref,
  ...props
}: ScrollAreaProps) {
  return (
    <div
      ref={ref}
      className={cn(
        "relative",
        orientation === "vertical" && "overflow-y-auto overflow-x-hidden",
        orientation === "horizontal" && "overflow-x-auto overflow-y-hidden",
        orientation === "both" && "overflow-auto",
        "scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function ScrollBar({
  orientation: _orientation = "vertical",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  orientation?: "vertical" | "horizontal";
  ref?: React.Ref<HTMLDivElement>;
}) {
  // ScrollBar is now handled by native CSS scrollbar styling
  // This component is kept for API compatibility but renders nothing
  void props;
  return null;
}

export { ScrollArea, ScrollBar };
