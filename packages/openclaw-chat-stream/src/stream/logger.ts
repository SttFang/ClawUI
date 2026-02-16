export interface StreamLogger {
  debug(tag: string, ...args: unknown[]): void
  info(tag: string, ...args: unknown[]): void
  warn(tag: string, ...args: unknown[]): void
}

export const noopStreamLogger: StreamLogger = {
  debug() {},
  info() {},
  warn() {},
}
