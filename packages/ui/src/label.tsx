import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "./utils";

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement>, VariantProps<typeof labelVariants> {
  ref?: React.Ref<HTMLLabelElement>;
}

function Label({ className, ref, ...props }: LabelProps) {
  return <label ref={ref} className={cn(labelVariants(), className)} {...props} />;
}

export { Label };
