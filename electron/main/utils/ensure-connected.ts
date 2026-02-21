import type { ChatWebSocketService } from "../services/chat/chat-websocket";
import type { ConfigService } from "../services/config";
import { loadOrCreateDeviceIdentity } from "../services/chat/device-identity";

/**
 * Shared helper: read gateway config -> set token/url -> init device identity -> connect if needed.
 */
export async function ensureGatewayConnected(
  configService: ConfigService,
  chatWebSocket: ChatWebSocketService,
  url?: string,
): Promise<void> {
  const config = await configService.getConfig();
  if (config?.gateway?.auth?.token) {
    chatWebSocket.setGatewayToken(config.gateway.auth.token);
  }
  if (url) {
    chatWebSocket.setGatewayUrl(url);
  } else if (config?.gateway?.port) {
    chatWebSocket.setGatewayUrl(`ws://127.0.0.1:${config.gateway.port}`);
  }

  chatWebSocket.setDeviceIdentity(loadOrCreateDeviceIdentity());

  if (!chatWebSocket.isConnected()) {
    await chatWebSocket.connect();
  }
}
