import { randomUUID } from "node:crypto";
import { ACP_PROTOCOL_VERSION } from "@clawui/constants/protocol";
import { chatLog } from "../../lib/logger";
import { buildDeviceAuthPayload, loadDeviceAuthToken, storeDeviceAuthToken } from "./device-auth";
import {
  publicKeyRawBase64UrlFromPem,
  signDevicePayload,
  type DeviceIdentity,
} from "./device-identity";

export interface ConnectFrameParams {
  clientVersion: string;
  instanceId: string;
  gatewayToken: string;
  deviceIdentity: DeviceIdentity | null;
  nonce: string | null;
}

export interface ConnectFrameResult {
  frame: {
    type: "req";
    id: string;
    method: "connect";
    params: Record<string, unknown>;
  };
  connectId: string;
}

export function buildConnectFrame(params: ConnectFrameParams): ConnectFrameResult {
  const connectId = randomUUID();
  const role = "operator";
  const scopes = ["operator.admin", "operator.read", "operator.approvals"];

  const storedToken = params.deviceIdentity
    ? loadDeviceAuthToken({ deviceId: params.deviceIdentity.deviceId, role })?.token
    : null;
  const authToken = params.gatewayToken || storedToken || undefined;

  const signedAtMs = Date.now();
  const nonce = params.nonce ?? undefined;

  let device: Record<string, unknown> | undefined;
  if (params.deviceIdentity) {
    const payload = buildDeviceAuthPayload({
      deviceId: params.deviceIdentity.deviceId,
      clientId: "openclaw-macos",
      clientMode: "ui",
      role,
      scopes,
      signedAtMs,
      token: authToken ?? null,
      nonce,
    });
    const signature = signDevicePayload(params.deviceIdentity.privateKeyPem, payload);
    device = {
      id: params.deviceIdentity.deviceId,
      publicKey: publicKeyRawBase64UrlFromPem(params.deviceIdentity.publicKeyPem),
      signature,
      signedAt: signedAtMs,
      nonce,
    };
  }

  return {
    connectId,
    frame: {
      type: "req",
      id: connectId,
      method: "connect",
      params: {
        minProtocol: ACP_PROTOCOL_VERSION,
        maxProtocol: ACP_PROTOCOL_VERSION,
        client: {
          id: "openclaw-macos",
          displayName: "ClawUI",
          version: params.clientVersion,
          platform: process.platform,
          mode: "ui",
          instanceId: params.instanceId,
        },
        role,
        scopes,
        caps: ["tool-events"],
        auth: authToken ? { token: authToken } : undefined,
        device,
      },
    },
  };
}

export function handleConnectResponsePayload(
  payload: unknown,
  role: string,
  deviceIdentity: DeviceIdentity | null,
): void {
  if (!deviceIdentity || !payload || typeof payload !== "object") return;
  const auth = (payload as Record<string, unknown>).auth as Record<string, unknown> | undefined;
  if (!auth) return;
  const deviceToken = typeof auth.deviceToken === "string" ? auth.deviceToken : null;
  if (deviceToken) {
    storeDeviceAuthToken({
      deviceId: deviceIdentity.deviceId,
      role: typeof auth.role === "string" ? auth.role : role,
      token: deviceToken,
      scopes: Array.isArray(auth.scopes) ? (auth.scopes as string[]) : [],
    });
    chatLog.info("[device.token.stored]", `role=${role}`);
  }
}

export function extractChallengeNonce(payload: unknown): string | null {
  const p = payload as { nonce?: unknown } | undefined;
  return p && typeof p.nonce === "string" ? p.nonce : null;
}
