import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import * as React from "react";
import { cn } from "./utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> & {
  ref?: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.Content>>;
}) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[12rem] overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-md",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  inset,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
  ref?: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.Item>>;
}) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-lg px-2 py-1.5 text-sm outline-none",
        "focus:bg-accent focus:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        inset && "pl-8",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator> & {
  ref?: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.Separator>>;
}) {
  return (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

export function DropdownMenuLabel({
  className,
  inset,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean;
  ref?: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.Label>>;
}) {
  return (
    <DropdownMenuPrimitive.Label
      ref={ref}
      className={cn(
        "px-2 py-1.5 text-xs font-medium text-muted-foreground",
        inset && "pl-8",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem> & {
  ref?: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>>;
}) {
  return (
    <DropdownMenuPrimitive.RadioItem
      ref={ref}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-lg py-1.5 pl-8 pr-2 text-sm outline-none",
        "focus:bg-accent focus:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}