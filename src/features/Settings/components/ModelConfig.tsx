import type { ModelCatalogEntry } from "@clawui/types/models";
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@clawui/ui";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface ModelConfigProps {
  defaultModel: string;
  fallbacks: string[];
  catalog: ModelCatalogEntry[];
  isLoading: boolean;
  onSetDefault: (model: string) => void;
  onAddFallback: (model: string) => void;
  onRemoveFallback: (model: string) => void;
}

/** Group catalog entries by provider prefix (before the first "/"). */
function groupByProvider(models: ModelCatalogEntry[]): Map<string, ModelCatalogEntry[]> {
  const groups = new Map<string, ModelCatalogEntry[]>();
  for (const m of models) {
    const slash = m.key.indexOf("/");
    const provider = slash > 0 ? m.key.slice(0, slash) : "other";
    const list = groups.get(provider);
    if (list) list.push(m);
    else groups.set(provider, [m]);
  }
  return groups;
}

function ModelCombobox({
  value,
  models,
  placeholder,
  disabled,
  onSelect,
}: {
  value: string;
  models: ModelCatalogEntry[];
  placeholder: string;
  disabled: boolean;
  onSelect: (model: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const grouped = useMemo(() => groupByProvider(models), [models]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="flex-1 justify-between font-mono text-sm min-w-0"
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>无匹配模型</CommandEmpty>
            {[...grouped.entries()].map(([provider, items]) => (
              <CommandGroup key={provider} heading={provider}>
                {items.map((m) => (
                  <CommandItem
                    key={m.key}
                    value={m.key}
                    onSelect={(v) => {
                      onSelect(v);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", value === m.key ? "opacity-100" : "opacity-0")}
                    />
                    <span className="font-mono truncate">{m.key}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ModelConfig({
  defaultModel,
  fallbacks,
  catalog,
  isLoading,
  onSetDefault,
  onAddFallback,
  onRemoveFallback,
}: ModelConfigProps) {
  const { t } = useTranslation("common");

  const usedModels = useMemo(
    () => new Set([defaultModel, ...fallbacks]),
    [defaultModel, fallbacks],
  );

  const availableFallbacks = useMemo(
    () => catalog.filter((m) => !usedModels.has(m.key)),
    [catalog, usedModels],
  );

  return (
    <div className="rounded-lg border p-3 space-y-3">
      {/* Default model */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground shrink-0 w-20">
          {t("settings.modelConfig.defaultModel")}
        </span>
        <ModelCombobox
          value={defaultModel}
          models={catalog}
          placeholder={t("settings.modelConfig.fallbackPlaceholder")}
          disabled={isLoading}
          onSelect={onSetDefault}
        />
      </div>

      {/* Fallback models */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground shrink-0 w-20">
            {t("settings.modelConfig.fallbacks")}
          </span>
          <ModelCombobox
            value=""
            models={availableFallbacks}
            placeholder={t("settings.modelConfig.fallbackPlaceholder")}
            disabled={isLoading}
            onSelect={onAddFallback}
          />
        </div>
        {fallbacks.length > 0 && (
          <div className="ml-[calc(5rem+0.75rem)] space-y-1">
            {fallbacks.map((fb, i) => (
              <div
                key={fb}
                className="flex items-center justify-between rounded border px-2 py-1 text-sm"
              >
                <span className="font-mono">
                  {i + 1}. {fb}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveFallback(fb)}
                  disabled={isLoading}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
