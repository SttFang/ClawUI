import log from 'electron-log/main.js'

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
