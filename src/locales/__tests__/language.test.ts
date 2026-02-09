import { describe, expect, it } from 'vitest'
import {
  normalizeLanguage,
  resolveEffectiveLanguage,
  resolveStoredLocale,
} from '../language'

describe('locales/language', () => {
  describe('normalizeLanguage', () => {
    it('should normalize zh variants to zh-CN', () => {
      expect(normalizeLanguage('zh')).toBe('zh-CN')
      expect(normalizeLanguage('zh-Hans')).toBe('zh-CN')
      expect(normalizeLanguage('zh-CN')).toBe('zh-CN')
    })

    it('should normalize en variants to en-US', () => {
      expect(normalizeLanguage('en')).toBe('en-US')
      expect(normalizeLanguage('en-GB')).toBe('en-US')
      expect(normalizeLanguage('en-US')).toBe('en-US')
    })

    it('should fallback to zh-CN for unknown values', () => {
      expect(normalizeLanguage('fr-FR')).toBe('zh-CN')
      expect(normalizeLanguage(undefined)).toBe('zh-CN')
    })
  })

  describe('resolveStoredLocale', () => {
    it('should parse system', () => {
      expect(resolveStoredLocale('system')).toBe('system')
    })

    it('should normalize stored language', () => {
      expect(resolveStoredLocale('en')).toBe('en-US')
      expect(resolveStoredLocale('zh')).toBe('zh-CN')
    })

    it('should return undefined for null/empty', () => {
      expect(resolveStoredLocale(null)).toBeUndefined()
      expect(resolveStoredLocale('')).toBeUndefined()
    })
  })

  describe('resolveEffectiveLanguage', () => {
    it('should treat undefined as system', () => {
      expect(resolveEffectiveLanguage(undefined, 'en-US')).toBe('en-US')
      expect(resolveEffectiveLanguage(undefined, 'zh-CN')).toBe('zh-CN')
    })

    it('should resolve system to navigator language', () => {
      expect(resolveEffectiveLanguage('system', 'en-US')).toBe('en-US')
      expect(resolveEffectiveLanguage('system', 'zh-CN')).toBe('zh-CN')
    })

    it('should prefer stored locale overrides', () => {
      expect(resolveEffectiveLanguage('en-US', 'zh-CN')).toBe('en-US')
      expect(resolveEffectiveLanguage('zh-CN', 'en-US')).toBe('zh-CN')
    })
  })
})

