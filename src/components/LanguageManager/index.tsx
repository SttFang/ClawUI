import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Button, Label, Select } from '@clawui/ui'
import { Globe } from 'lucide-react'
import { IconActionButton } from '@/components/IconActionButton'
import { i18n } from '@/locales/i18n'
import {
  LANG_STORAGE_KEY,
  resolveStoredLocale,
  resolveEffectiveLanguage,
  normalizeLanguage,
  type StoredLocale,
} from '@/locales/language'

function readStoredLocale(): StoredLocale | undefined {
  if (typeof window === 'undefined') return undefined
  return resolveStoredLocale(window.localStorage.getItem(LANG_STORAGE_KEY))
}

function writeStoredLocale(next: StoredLocale) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LANG_STORAGE_KEY, next)
}

export function LanguageManager() {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)

  const storedLocale = useMemo(() => readStoredLocale(), [open])
  const effective = useMemo(() => {
    if (typeof navigator === 'undefined') return normalizeLanguage(i18n.language)
    return resolveEffectiveLanguage(storedLocale, navigator.language)
  }, [storedLocale])

  const selectedValue: StoredLocale = storedLocale ?? 'system'

  const applyLocale = async (next: StoredLocale) => {
    writeStoredLocale(next)
    const lang = next === 'system'
      ? resolveEffectiveLanguage('system', navigator.language)
      : next
    await i18n.changeLanguage(lang)
  }

  return (
    <div className="titlebar-no-drag flex items-center gap-1.5 px-1">
      <IconActionButton
        icon={<Globe className="h-4 w-4" />}
        title={t('language.manage')}
        onClick={() => setOpen(true)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onClose={() => setOpen(false)}>
          <DialogHeader>
            <DialogTitle>{t('language.manage')}</DialogTitle>
            <DialogDescription>{t('language.current')}: {effective}</DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-2">
            <Label htmlFor="language">{t('language.manage')}</Label>
            <Select
              id="language"
              value={selectedValue}
              onChange={(e) => void applyLocale(e.target.value as StoredLocale)}
            >
              <option value="system">{t('language.system')}</option>
              <option value="zh-CN">{t('language.zhCN')}</option>
              <option value="en-US">{t('language.enUS')}</option>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('actions.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

