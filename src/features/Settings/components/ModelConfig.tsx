import type { ModelCatalogEntry } from "@clawui/types/models";
import type { ChangeEvent } from "react";
import { Button, Input, Select } from "@clawui/ui";
import { Plus, X } from "lucide-react";
import { useState } from "react";
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
  const [fallbackInput, setFallbackInput] = useState("");

  const handleAddFallback = () => {
    const value = fallbackInput.trim();
    if (!value) return;
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
        <Select
          value={defaultModel}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onSetDefault(e.target.value)}
          disabled={isLoading || catalog.length === 0}
          className="flex-1"
        >
          {catalog.map((model) => (
            <option key={model.key} value={model.key}>
              {model.key}
            </option>
          ))}
        </Select>
      </div>

      {/* Fallback models */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground shrink-0 w-20">
            {t("settings.modelConfig.fallbacks")}
          </span>
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={fallbackInput}
              onChange={(e) => setFallbackInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddFallback()}
              placeholder={t("settings.modelConfig.fallbackPlaceholder")}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddFallback}
              disabled={isLoading || !fallbackInput.trim()}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
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
