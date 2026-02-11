import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@clawui/ui";
import { Check, Globe } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { IconActionButton } from "@/components/IconActionButton";
import { i18n } from "@/locales/i18n";
import { normalizeLanguage, resolveEffectiveLanguage } from "@/locales/language";
import { useUIStore, selectLocale, type LocalePreference } from "@/store/ui";

const LANGUAGE_OPTIONS: Array<{ value: LocalePreference; labelKey: string }> = [
  { value: "system", labelKey: "language.system" },
  { value: "zh-CN", labelKey: "language.zhCN" },
  { value: "en-US", labelKey: "language.enUS" },
];

export function LanguageManager() {
  const { t } = useTranslation("common");

  const locale = useUIStore(selectLocale);
  const setLocale = useUIStore((s) => s.setLocale);

  const effective = useMemo(() => {
    if (typeof navigator === "undefined") return normalizeLanguage(i18n.language);
    return resolveEffectiveLanguage(locale, navigator.language);
  }, [locale]);

  return (
    <div className="titlebar-no-drag flex items-center gap-1.5 px-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconActionButton icon={<Globe className="h-4 w-4" />} title={t("language.manage")} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            {t("language.current")}: {effective}
          </DropdownMenuLabel>
          {LANGUAGE_OPTIONS.map((opt) => (
            <DropdownMenuItem key={opt.value} onClick={() => setLocale(opt.value)}>
              <Check
                className={`mr-2 h-3.5 w-3.5 ${locale === opt.value ? "opacity-100" : "opacity-0"}`}
              />
              {t(opt.labelKey)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
