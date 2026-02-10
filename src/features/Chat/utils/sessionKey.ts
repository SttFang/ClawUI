import type { SessionFilter, SessionSource } from '../types'

export function classifySessionKey(sessionKey: string): { source: SessionSource; hidden: boolean } {
  const raw = sessionKey.trim()
  if (!raw) return { source: 'unknown', hidden: false }

  const parts = raw.split(':').filter(Boolean)
  const rest = parts[0] === 'agent' && parts.length >= 3 ? parts.slice(2) : parts
  const head = (rest[0] ?? '').toLowerCase()
  const head2 = (rest[1] ?? '').toLowerCase()

  // Hide ClawUI internal metadata sessions by default.
  // Examples:
  // - clawui:meta:<sessionKey>
  // - agent:main:clawui:meta:<sessionKey>
  if (head === 'clawui' && head2 === 'meta') return { source: 'unknown', hidden: true }
  if (head === 'meta') return { source: 'unknown', hidden: true }

  if (head === 'ui') return { source: 'ui', hidden: false }
  if (head === 'cron') return { source: 'cron', hidden: false }

  if (head === 'discord') return { source: 'discord', hidden: false }
  if (head === 'telegram') return { source: 'telegram', hidden: false }
  if (head === 'slack') return { source: 'slack', hidden: false }
  if (head === 'whatsapp') return { source: 'whatsapp', hidden: false }
  if (head === 'wechat') return { source: 'wechat', hidden: false }
  if (head === 'signal') return { source: 'signal', hidden: false }

  return { source: 'unknown', hidden: false }
}

export function classifySession(params: { sessionKey: string; surface?: string | null }): { source: SessionSource; hidden: boolean } {
  const surface = (params.surface ?? '').trim().toLowerCase()
  if (surface === 'discord') return { source: 'discord', hidden: false }
  if (surface === 'telegram') return { source: 'telegram', hidden: false }
  if (surface === 'slack') return { source: 'slack', hidden: false }
  if (surface === 'whatsapp') return { source: 'whatsapp', hidden: false }
  if (surface === 'wechat') return { source: 'wechat', hidden: false }
  if (surface === 'signal') return { source: 'signal', hidden: false }
  if (surface === 'cron') return { source: 'cron', hidden: false }

  return classifySessionKey(params.sessionKey)
}

export function matchesSessionFilter(source: SessionSource, filter: SessionFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'ui') return source === 'ui'
  if (filter === 'discord') return source === 'discord'
  // channels: show all non-UI channel sessions (discord/telegram/...).
  return source !== 'ui' && source !== 'cron' && source !== 'unknown'
}

export function getSessionSourceBadge(source: SessionSource): string | null {
  return source === 'ui'
    ? 'UI'
    : source === 'discord'
      ? 'Discord'
      : source === 'telegram'
        ? 'Telegram'
        : source === 'slack'
          ? 'Slack'
          : source === 'whatsapp'
            ? 'WhatsApp'
            : source === 'wechat'
              ? 'WeChat'
              : source === 'signal'
                ? 'Signal'
                : source === 'cron'
                  ? 'Cron'
                  : null
}
