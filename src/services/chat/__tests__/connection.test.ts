import { describe, expect, it, vi } from "vitest";

async function loadModules() {
  vi.resetModules();
  const connection = await import("../connection");
  const { ipc } = await import("@/lib/ipc");
  return { connection, ipc };
}

describe("chat connection service", () => {
  it("skips connect when already connected", async () => {
    const { connection, ipc } = await loadModules();
    vi.spyOn(ipc.chat, "isConnected").mockResolvedValue(true);
    const connectSpy = vi.spyOn(ipc.chat, "connect").mockResolvedValue(true);

    await connection.ensureChatConnected();

    expect(connectSpy).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent ensureChatConnected calls", async () => {
    const { connection, ipc } = await loadModules();
    vi.spyOn(ipc.chat, "isConnected").mockResolvedValue(false);
    const connectSpy = vi.spyOn(ipc.chat, "connect").mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return true;
    });

    await Promise.all([
      connection.ensureChatConnected(),
      connection.ensureChatConnected(),
      connection.ensureChatConnected(),
    ]);

    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it("throws a stable error when connect returns false", async () => {
    const { connection, ipc } = await loadModules();
    vi.spyOn(ipc.chat, "isConnected").mockResolvedValue(false);
    vi.spyOn(ipc.chat, "connect").mockResolvedValue(false);

    await expect(connection.ensureChatConnected()).rejects.toThrow("Gateway WebSocket unavailable");
  });

  it("allows retry after a failed connect attempt", async () => {
    const { connection, ipc } = await loadModules();
    vi.spyOn(ipc.chat, "isConnected").mockResolvedValue(false);
    const connectSpy = vi
      .spyOn(ipc.chat, "connect")
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await expect(connection.ensureChatConnected()).rejects.toThrow("Gateway WebSocket unavailable");
    await expect(connection.ensureChatConnected()).resolves.toBeUndefined();

    expect(connectSpy).toHaveBeenCalledTimes(2);
  });
});
