import * as React from "react";
import { cn } from "./utils";

type CollapsibleContextValue = {
  open: boolean;
  setOpen: (nextOpen: boolean) => void;
};

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(null);

function useCollapsibleContext(): CollapsibleContextValue {
  const ctx = React.useContext(CollapsibleContext);
  if (!ctx) {
    throw new Error("Collapsible components must be used within <Collapsible>");
  }
  return ctx;
}

export type CollapsibleProps = React.ComponentPropsWithoutRef<"div"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function Collapsible({
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  className,
  children,
  ...props
}: CollapsibleProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = typeof openProp === "boolean";
  const open = isControlled ? openProp : uncontrolledOpen;

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  return (
    <CollapsibleContext.Provider value={{ open, setOpen }}>
      <div data-state={open ? "open" : "closed"} className={cn(className)} {...props}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
}

export type CollapsibleTriggerProps = React.ComponentPropsWithoutRef<"button"> & {
  asChild?: boolean;
};

export function CollapsibleTrigger({
  asChild = false,
  className,
  children,
  onClick,
  ...props
}: CollapsibleTriggerProps) {
  const { open, setOpen } = useCollapsibleContext();

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    onClick?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
    if (event.defaultPrevented) return;
    setOpen(!open);
  };

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{
      className?: string;
      onClick?: (event: React.MouseEvent<HTMLElement>) => void;
      "aria-expanded"?: boolean;
      "data-state"?: "open" | "closed";
    }>;
    return React.cloneElement(child, {
      ...props,
      className: cn(child.props.className, className),
      onClick: handleClick,
      "aria-expanded": open,
      "data-state": open ? "open" : "closed",
    });
  }

  return (
    <button
      type="button"
      className={cn(className)}
      onClick={handleClick}
      aria-expanded={open}
      data-state={open ? "open" : "closed"}
      {...props}
    >
      {children}
    </button>
  );
}

export type CollapsibleContentProps = React.ComponentPropsWithoutRef<"div"> & {
  forceMount?: boolean;
};

export function CollapsibleContent({
  forceMount = false,
  className,
  children,
  ...props
}: CollapsibleContentProps) {
  const { open } = useCollapsibleContext();
  if (!open && !forceMount) return null;

  return (
    <div data-state={open ? "open" : "closed"} className={cn(className)} {...props}>
      {children}
    </div>
  );
}
