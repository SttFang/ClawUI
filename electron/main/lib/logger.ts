import log from 'electron-log/main.js'

// ---------------------------------------------------------------------------
// Sensitive-data filter — prevents tokens & API keys from leaking into logs
// ---------------------------------------------------------------------------
const SENSITIVE_PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]+/g,
  /sk-[A-Za-z0-9_-]{20,}/g,
  /xoxb-[A-Za-z0-9_-]+/g,
  /xapp-[A-Za-z0-9_-]+/g,
  /[A-Za-z0-9_-]{40,}/g, // generic long token catch-all
]

// Key-based filtering for structured objects (best-effort)
const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'password',
  'token',
  'access_token',
  'refresh_token',
  'apikey',
  'api_key',
  'secret',
  'email',
  'phone',
])

function redact(value: unknown): unknown {
  if (typeof value === 'string') {
    let result = value
    for (const pattern of SENSITIVE_PATTERNS) {
      result = result.replace(pattern, (match) => {
        if (match.length <= 8) return match // too short to be a token
        return `${match.slice(0, 4)}***${match.slice(-4)}`
      })
    }
    return result
  }

  if (Array.isArray(value)) {
    return value.map(redact)
  }

  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        result[key] = '[REDACTED]'
      } else {
        result[key] = redact(val)
      }
    }
    return result
  }

  return value
}

// ---------------------------------------------------------------------------
// Initialisation — call once from electron/main/index.ts
// ---------------------------------------------------------------------------
export function initLogger(): void {
  log.initialize()

  // File transport
  log.transports.file.level = 'info'
  log.transports.file.maxSize = 5 * 1024 * 1024 // 5 MB
  log.transports.file.format =
    '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}]{scope} {text}'

  // Console transport — verbose in dev, silent in packaged builds
  log.transports.console.level = 'debug'
  log.transports.console.format = '{h}:{i}:{s}.{ms} [{level}]{scope} {text}'

  // Redact sensitive data before it reaches any transport
  log.hooks.push((message) => {
    message.data = message.data.map(redact)
    return message
  })

  // Catch unhandled errors
  log.errorHandler.startCatching()
}

// ---------------------------------------------------------------------------
// Scoped loggers — one per service / module
// ---------------------------------------------------------------------------
export const mainLog = log.scope('main')
export const gatewayLog = log.scope('gateway')
export const chatLog = log.scope('chat')
export const configLog = log.scope('config')
export const updaterLog = log.scope('updater')
export const installerLog = log.scope('installer')
export const detectorLog = log.scope('detector')
export const onboardingLog = log.scope('onboarding')

export default log
