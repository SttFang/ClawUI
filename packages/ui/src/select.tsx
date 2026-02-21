import { ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "./utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  ref?: React.Ref<HTMLSelectElement>;
}

function Select({ className, children, ref, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={cn(
          "flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm ring-offset-background",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
    </div>
  );
}

export { Select };
