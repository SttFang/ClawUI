import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerGatewayHandlers } from "../../electron/main/ipc/gateway";
import { execInLoginShell } from "../../electron/main/utils/login-shell";

const mockedExecInLoginShell = vi.fn(async () => ({ stdout: "", stderr: "" }));

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

vi.mock("../../electron/main/utils/login-shell", () => ({
  execInLoginShell: mockedExecInLoginShell,
  buildLoginShellInvocation: vi.fn(() => ({
    file: "sh",
    args: [],
  })),
}));

describe("gateway ipc handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createConfigService = () => {
    const initialize = vi.fn(async () => undefined);
    const getConfig = vi.fn(async () => null as Record<string, unknown> | null);
    return {
      initialize,
      getConfig,
    };
  };

  const createGateway = () => {
    const start = vi.fn(async () => undefined);
    const stop = vi.fn(async () => undefined);
    return {
      on: vi.fn(),
      setConfig: vi.fn(),
      start,
      stop,
      getStatus: vi.fn(),
      getWebSocketUrl: vi.fn(),
    };
  };

  const createIpcMain = () => {
    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown> | unknown>();
    return {
      handlers,
      handle: vi.fn(
        (event: string, handler: (...args: unknown[]) => Promise<unknown> | unknown) => {
          handlers.set(event, handler);
        },
      ),
    };
  };

  it("gateway:start should refresh config before launching gateway", async () => {
    const configService = createConfigService();
    const gateway = createGateway();
    const ipcMain = createIpcMain();
    const order: string[] = [];

    configService.initialize.mockImplementation(async () => {
      order.push("initialize");
    });
    configService.getConfig.mockImplementation(async () => {
      order.push("getConfig");
      return {
        gateway: {
          port: 19999,
          bind: "loopback",
          auth: {
            mode: "token",
            token: "token-9",
          },
        },
      } as const;
    });
    gateway.setConfig.mockImplementation(() => {
      order.push("setConfig");
    });
    gateway.start.mockImplementation(async () => {
      order.push("start");
    });

    registerGatewayHandlers(ipcMain as never, gateway as never, configService as never);

    const startHandler = ipcMain.handlers.get("gateway:start");
    expect(startHandler).toBeTypeOf("function");
    await startHandler?.();

    expect(order).toEqual(["initialize", "getConfig", "setConfig", "start"]);
    expect(gateway.setConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        gateway: expect.objectContaining({ port: 19999 }),
      }),
    );
  });

  it("gateway:install-service should refresh config before install command", async () => {
    const configService = createConfigService();
    const gateway = createGateway();
    const ipcMain = createIpcMain();
    const order: string[] = [];

    configService.initialize.mockImplementation(async () => {
      order.push("initialize");
    });
    configService.getConfig.mockImplementation(async () => {
      order.push("getConfig");
      return {
        gateway: {
          port: 21111,
          bind: "loopback",
          auth: {
            mode: "token",
            token: "token-9",
          },
        },
      } as const;
    });
    gateway.setConfig.mockImplementation(() => {
      order.push("setConfig");
    });
    mockedExecInLoginShell.mockResolvedValue({ stdout: "", stderr: "" });

    registerGatewayHandlers(ipcMain as never, gateway as never, configService as never);
    const installHandler = ipcMain.handlers.get("gateway:install-service");
    expect(installHandler).toBeTypeOf("function");
    await installHandler?.();

    expect(order).toEqual(["initialize", "getConfig", "setConfig"]);
    expect(execInLoginShell).toHaveBeenCalledTimes(1);
    expect(execInLoginShell).toHaveBeenCalledWith(
      expect.stringContaining("openclaw gateway install --force"),
      expect.objectContaining({ timeoutMs: 120_000 }),
    );
  });
});
