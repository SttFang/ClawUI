import log from 'electron-log/renderer.js'

// ---------------------------------------------------------------------------
// Scoped loggers for renderer modules
// ---------------------------------------------------------------------------
export const startupLog = log.scope('startup')
export const chatLog = log.scope('chat')
export const schedulerLog = log.scope('scheduler')
export const toolsLog = log.scope('tools')
export const channelsLog = log.scope('channels')
export const subscriptionLog = log.scope('subscription')
export const uiLog = log.scope('ui')
