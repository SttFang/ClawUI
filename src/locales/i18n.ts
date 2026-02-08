import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import resources from './default'

const DEFAULT_LANG = 'zh-CN'
const STORAGE_KEY = 'clawui-locale'
const SUPPORTED_LANGS = ['zh-CN', 'en-US'] as const
type SupportedLang = (typeof SUPPORTED_LANGS)[number]

const normalizeLanguage = (language?: string): SupportedLang => {
  if (!language) return DEFAULT_LANG

  const value = language.toLowerCase()
  if (value.startsWith('zh')) return 'zh-CN'
  if (value.startsWith('en')) return 'en-US'

  return DEFAULT_LANG
}

const getStoredLanguage = (): SupportedLang | undefined => {
  if (typeof window === 'undefined') return undefined

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (!stored) return undefined

  return normalizeLanguage(stored)
}

const resolveLanguage = () => {
  if (typeof navigator === 'undefined') return DEFAULT_LANG

  return getStoredLanguage() ?? normalizeLanguage(navigator.language)
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      'zh-CN': resources,
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
    ns: Object.keys(resources),
  })
}

i18n.on('languageChanged', (language) => {
  if (typeof window === 'undefined') return

  const normalized = normalizeLanguage(language)
  window.localStorage.setItem(STORAGE_KEY, normalized)
  document.documentElement.lang = normalized
})

export { i18n }
