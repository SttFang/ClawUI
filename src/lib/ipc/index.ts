// IPC client for renderer process
// This module provides type-safe IPC communication with the main process

export { getElectronAPI } from "./types";
export type { ElectronAPI } from "./types";

// Re-export all types for backward compatibility
export type {
  RuntimeStatus,
  InstallProgress,
  BYOKConfig,
  ChatRequest,
  ChatStreamEvent,
  ChatNormalizedRunEvent,
  OpenClawConfig,
  OnboardingOpenClawConfig,
  ChannelConfig,
  GatewayStatus,
  GatewayEventFrame,
  LoginCredentials,
  LoginResult,
  SubscriptionStatus,
  UpdateInfo,
  OnboardingSubscriptionConfig,
  SkillEntry,
  SkillsListResult,
  ModelsAuthLoginOptions,
  ModelsAuthOrderInput,
  ModelsAuthOrderSetInput,
  WorkspaceFileEntry,
  WorkspaceListResult,
  WorkspaceReadFileResult,
  WorkspaceReadFileBase64Result,
  PythonRunResult,
  DeepPartial,
} from "./types";

import { app, metadata, subscription } from "./app";
import { chat } from "./chat";
import { config, profiles, state } from "./config";
import { credentials, secrets, security } from "./credentials";
import { gateway } from "./gateway";
import { models } from "./models";
import { onboarding } from "./onboarding";
import { rescue } from "./rescue";
import { usage } from "./usage";
import { skills, workspace } from "./workspace";

// Typed IPC helpers
export const ipc = {
  gateway,
  config,
  profiles,
  state,
  subscription,
  app,
  onboarding,
  chat,
  usage,
  models,
  metadata,
  secrets,
  credentials,
  security,
  skills,
  workspace,
  rescue,
};
