import type { ModelCatalogEntry } from "@clawui/types/models";
import { Button, Input } from "@clawui/ui";
import { Plus, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

interface ModelConfigProps {
  defaultModel: string;
  fallbacks: string[];
  catalog: ModelCatalogEntry[];
  isLoading: boolean;
  onSetDefault: (model: string) => void;
  onAddFallback: (model: string) => void;
  onRemoveFallback: (model: string) => void;
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
  const [defaultInput, setDefaultInput] = useState(defaultModel);
  const [fallbackInput, setFallbackInput] = useState("");
  const defaultListId = useId();
  const fallbackListId = useId();

  const usedModels = useMemo(
    () => new Set([defaultModel, ...fallbacks]),
    [defaultModel, fallbacks],
  );

  const availableFallbacks = useMemo(
    () => catalog.filter((m) => !usedModels.has(m.key)),
    [catalog, usedModels],
  );

  const handleSetDefault = () => {
    const value = defaultInput.trim();
    if (value && value !== defaultModel) {
      onSetDefault(value);
    }
  };

  const handleAddFallback = () => {
    const value = fallbackInput.trim();
    if (!value || usedModels.has(value)) return;
    onAddFallback(value);
    setFallbackInput("");
  };

  return (
    <div className="rounded-lg border p-3 space-y-3">
      {/* Default model */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground shrink-0 w-20">
          {t("settings.modelConfig.defaultModel")}
        </span>
        <Input
          list={defaultListId}
          value={defaultInput}
          onChange={(e) => setDefaultInput(e.target.value)}
          onBlur={handleSetDefault}
          onKeyDown={(e) => e.key === "Enter" && handleSetDefault()}
          placeholder={t("settings.modelConfig.fallbackPlaceholder")}
          disabled={isLoading}
          className="flex-1 font-mono text-sm"
        />
        <datalist id={defaultListId}>
          {catalog.map((model) => (
            <option key={model.key} value={model.key} />
          ))}
        </datalist>
      </div>

      {/* Fallback models */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground shrink-0 w-20">
            {t("settings.modelConfig.fallbacks")}
          </span>
          <Input
            list={fallbackListId}
            value={fallbackInput}
            onChange={(e) => setFallbackInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddFallback()}
            placeholder={t("settings.modelConfig.fallbackPlaceholder")}
            disabled={isLoading}
            className="flex-1 font-mono text-sm"
          />
          <datalist id={fallbackListId}>
            {availableFallbacks.map((model) => (
              <option key={model.key} value={model.key} />
            ))}
          </datalist>
          <Button
            variant="outline"
            size="icon"
            onClick={handleAddFallback}
            disabled={isLoading || !fallbackInput.trim()}
            className="shrink-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
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
