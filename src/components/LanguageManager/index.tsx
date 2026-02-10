import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Label,
  Select,
} from "@clawui/ui";
import { Globe } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconActionButton } from "@/components/IconActionButton";
import { i18n } from "@/locales/i18n";
import { normalizeLanguage, resolveEffectiveLanguage } from "@/locales/language";
import { useUIStore, selectLocale, type LocalePreference } from "@/store/ui";

export function LanguageManager() {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);

  const locale = useUIStore(selectLocale);
  const setLocale = useUIStore((s) => s.setLocale);

  const effective = useMemo(() => {
    if (typeof navigator === "undefined") return normalizeLanguage(i18n.language);
    return resolveEffectiveLanguage(locale, navigator.language);
  }, [locale]);

  return (
    <div className="titlebar-no-drag flex items-center gap-1.5 px-1">
      <IconActionButton
        icon={<Globe className="h-4 w-4" />}
        title={t("language.manage")}
        onClick={() => setOpen(true)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onClose={() => setOpen(false)}>
          <DialogHeader>
            <DialogTitle>{t("language.manage")}</DialogTitle>
            <DialogDescription>
              {t("language.current")}: {effective}
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-2">
            <Label htmlFor="language">{t("language.manage")}</Label>
            <Select
              id="language"
              value={locale}
              onChange={(e) => setLocale(e.target.value as LocalePreference)}
            >
              <option value="system">{t("language.system")}</option>
              <option value="zh-CN">{t("language.zhCN")}</option>
              <option value="en-US">{t("language.enUS")}</option>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("actions.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
