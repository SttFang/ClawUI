import log from "electron-log/main.js";
import { redact } from "./redact";

// ---------------------------------------------------------------------------
// Initialisation — call once from electron/main/index.ts
// ---------------------------------------------------------------------------
export function initLogger(): void {
  log.initialize();

  // File transport
  log.transports.file.level = "info";
  log.transports.file.maxSize = 5 * 1024 * 1024; // 5 MB
  log.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}]{scope} {text}";

  // Console transport — verbose in dev, silent in packaged builds
  log.transports.console.level = "debug";
  log.transports.console.format = "{h}:{i}:{s}.{ms} [{level}]{scope} {text}";

  // Redact sensitive data before it reaches any transport
  log.hooks.push((message) => {
    message.data = message.data.map(redact);
    return message;
  });

  // Catch unhandled errors
  log.errorHandler.startCatching();
}
