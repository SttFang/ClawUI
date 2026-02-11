import { ipc } from "@/lib/ipc";

const CONNECT_ERROR_MESSAGE = "Gateway WebSocket unavailable";

let connectPromise: Promise<void> | null = null;

export async function ensureChatConnected(url?: string): Promise<void> {
  if (await ipc.chat.isConnected()) {
    return;
  }

  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    const ok = await ipc.chat.connect(url);
    if (!ok) {
      throw new Error(CONNECT_ERROR_MESSAGE);
    }
  })().finally(() => {
    connectPromise = null;
  });

  return connectPromise;
}

export async function disconnectChat(): Promise<void> {
  connectPromise = null;
  await ipc.chat.disconnect();
}

export async function isChatConnected(): Promise<boolean> {
  return await ipc.chat.isConnected();
}
