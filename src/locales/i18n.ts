import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhResources from './default'
import enResources from './en-US'
import {
  DEFAULT_LANG,
  SUPPORTED_LANGS,
  normalizeLanguage,
  resolveEffectiveLanguage,
} from './language'

const resolveInitialLanguage = () => {
  if (typeof navigator === 'undefined') return DEFAULT_LANG
  return resolveEffectiveLanguage('system', navigator.language)
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      'zh-CN': zhResources,
      'en-US': enResources,
    },
    lng: resolveInitialLanguage(),
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

  document.documentElement.lang = normalized
})

// Ensure initial <html lang="..."> is correct even before the first change event.
if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language
}

export { i18n }
