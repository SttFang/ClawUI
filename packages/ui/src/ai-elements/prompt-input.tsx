import * as React from "react";

import { Button, type ButtonProps } from "../button";
import { cn } from "../utils";

export type PromptInputProps = Omit<React.ComponentPropsWithoutRef<"form">, "onSubmit"> & {
  onSubmit?: () => void;
};

export function PromptInput(props: PromptInputProps) {
  const { className, onSubmit, children, ...rest } = props;
  return (
    <form
      className={cn(
        "rounded-xl border bg-background",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
        className,
      )}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
      {...rest}
    >
      {children}
    </form>
  );
}

export type PromptInputTextareaProps = React.ComponentPropsWithoutRef<"textarea">;

export const PromptInputTextarea = React.forwardRef<HTMLTextAreaElement, PromptInputTextareaProps>(
  function PromptInputTextarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full resize-none bg-transparent px-4 py-3 text-sm outline-none",
          "min-h-[44px] max-h-40",
          // Make long tokens/URLs wrap instead of expanding the whole composer.
          "whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
          className,
        )}
        rows={1}
        {...rest}
      />
    );
  },
);

export function PromptInputFooter(props: React.ComponentPropsWithoutRef<"div">) {
  const { className, ...rest } = props;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2",
        className,
      )}
      {...rest}
    />
  );
}

export function PromptInputTools(props: React.ComponentPropsWithoutRef<"div">) {
  const { className, ...rest } = props;
  return <div className={cn("flex flex-wrap items-center gap-2", className)} {...rest} />;
}

export function PromptInputActions(props: React.ComponentPropsWithoutRef<"div">) {
  const { className, ...rest } = props;
  return <div className={cn("flex items-center gap-2", className)} {...rest} />;
}

export function PromptInputAction(props: ButtonProps) {
  const { className, variant = "outline", size = "sm", ...rest } = props;
  return <Button className={cn("h-8", className)} variant={variant} size={size} {...rest} />;
}

export function PromptInputSubmit(props: Omit<ButtonProps, "type">) {
  const { children = "Send", ...rest } = props;
  return (
    <PromptInputAction type="submit" {...rest}>
      {children}
    </PromptInputAction>
  );
}

