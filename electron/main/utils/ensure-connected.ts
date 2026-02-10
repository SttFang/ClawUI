import { chatWebSocket } from "../services/chat-websocket";
import type { ConfigService } from "../services/config";

/**
 * Shared helper: read gateway config → set token/url → connect if needed.
 */
export async function ensureGatewayConnected(
  configService: ConfigService,
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
  if (!chatWebSocket.isConnected()) {
    await chatWebSocket.connect();
  }
}
