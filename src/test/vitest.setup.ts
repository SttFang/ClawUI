import { vi } from "vitest";

// electron-log assumes an Electron main process. In jsdom unit tests we mock it
// to avoid open handles / IPC warnings that prevent Vitest from exiting.
vi.mock("electron-log/renderer.js", () => {
  const noop = () => {};

  const logger = {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    scope: () => logger,
  };

  return { default: logger };
});
