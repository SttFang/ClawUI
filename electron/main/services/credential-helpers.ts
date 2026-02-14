import type { CredentialMode } from "@clawui/types/credentials";
import type { AuthProfileCredential } from "./auth-profile-adapter";

export function maskSecret(value: string): string {
  if (value.length <= 8) return "***";
  const prefix = value.slice(0, 7);
  const suffix = value.slice(-3);
  return `${prefix}***...${suffix}`;
}

export function profileIdForProvider(provider: string): string {
  return `${provider}:default`;
}

export function credentialHasValue(cred: AuthProfileCredential): boolean {
  if (cred.type === "api_key") return Boolean(cred.key);
  if (cred.type === "token") return Boolean(cred.token);
  if (cred.type === "oauth") return Boolean(cred.access);
  return false;
}

export function credentialSecret(cred: AuthProfileCredential): string {
  if (cred.type === "api_key") return cred.key ?? "";
  if (cred.type === "token") return cred.token;
  if (cred.type === "oauth") return cred.access;
  return "";
}

export function credentialMode(cred: AuthProfileCredential): CredentialMode {
  return cred.type === "api_key" ? "api_key" : cred.type;
}
