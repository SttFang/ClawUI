import * as React from "react";
import { cn } from "./utils";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be used within a Tabs provider");
  }
  return context;
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  ref?: React.Ref<HTMLDivElement>;
}

function Tabs({ defaultValue = "", value, onValueChange, children, ref, ...props }: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const currentValue = value !== undefined ? value : internalValue;

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (value === undefined) {
        setInternalValue(newValue);
      }
      onValueChange?.(newValue);
    },
    [value, onValueChange],
  );

  return (
    <TabsContext.Provider value={{ value: currentValue, onValueChange: handleValueChange }}>
      <div ref={ref} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

function TabsList({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      role="tablist"
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  ref?: React.Ref<HTMLButtonElement>;
}

function TabsTrigger({ className, value, ref, ...props }: TabsTriggerProps) {
  const { value: selectedValue, onValueChange } = useTabsContext();
  const isSelected = selectedValue === value;
  const triggerId = `tab-trigger-${value}`;
  const panelId = `tab-panel-${value}`;

  return (
    <button
      ref={ref}
      id={triggerId}
      role="tab"
      type="button"
      aria-selected={isSelected}
      aria-controls={panelId}
      data-state={isSelected ? "active" : "inactive"}
      onClick={() => onValueChange(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isSelected && "bg-background text-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  ref?: React.Ref<HTMLDivElement>;
}

function TabsContent({ className, value, ref, ...props }: TabsContentProps) {
  const { value: selectedValue } = useTabsContext();
  const isSelected = selectedValue === value;
  const triggerId = `tab-trigger-${value}`;
  const panelId = `tab-panel-${value}`;

  if (!isSelected) return null;

  return (
    <div
      ref={ref}
      id={panelId}
      role="tabpanel"
      aria-labelledby={triggerId}
      data-state={isSelected ? "active" : "inactive"}
      className={cn(
        "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
