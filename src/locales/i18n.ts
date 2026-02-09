import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhResources from './default'
import enResources from './en-US'
import {
  DEFAULT_LANG,
  LANG_STORAGE_KEY,
  SUPPORTED_LANGS,
  normalizeLanguage,
  resolveEffectiveLanguage,
  resolveStoredLocale,
  type StoredLocale,
} from './language'

const getStoredLocale = (): StoredLocale | undefined => {
  if (typeof window === 'undefined') return undefined

  return resolveStoredLocale(window.localStorage.getItem(LANG_STORAGE_KEY))
}

const resolveLanguage = () => {
  if (typeof navigator === 'undefined') return DEFAULT_LANG

  return resolveEffectiveLanguage(getStoredLocale(), navigator.language)
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      'zh-CN': zhResources,
      'en-US': enResources,
    },
    lng: resolveLanguage(),
    fallbackLng: DEFAULT_LANG,
    supportedLngs: SUPPORTED_LANGS,
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
    ns: Object.keys(zhResources),
  })
}

i18n.on('languageChanged', (language) => {
  if (typeof window === 'undefined') return

  const normalized = normalizeLanguage(language)

  const stored = getStoredLocale()
  // Treat "no stored value" as system mode: don't persist explicit language
  // unless the user has opted into a concrete locale override.
  if (stored && stored !== 'system') {
    window.localStorage.setItem(LANG_STORAGE_KEY, normalized)
  }

  document.documentElement.lang = normalized
})

// Ensure initial <html lang="..."> is correct even before the first change event.
if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language
}

export { i18n }
