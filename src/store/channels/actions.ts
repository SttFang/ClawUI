import type { ChannelConfig } from "@/lib/ipc";
import { ipc } from "@/lib/ipc";
import { useConfigDraftStore } from "@/store/configDraft";
import type {
  ChannelType,
  ChannelsInternalActions,
  ChannelsPublicActions,
  ChannelsStore,
} from "./types";
import { buildActualChannelPatch, mapSnapshotToChannels } from "./helpers";

type SetChannelsState = (
  partial:
    | Partial<ChannelsStore>
    | ((state: ChannelsStore) => Partial<ChannelsStore> | ChannelsStore),
  replace?: false,
  action?: string,
) => void;

type GetChannelsState = () => ChannelsStore;

export function createChannelsActions(
  set: SetChannelsState,
  get: GetChannelsState,
): ChannelsPublicActions & ChannelsInternalActions {
  return {
    internal_dispatchChannels: (updater, action) => {
      set(
        (state) => ({
          channels: updater(state.channels),
        }),
        false,
        action,
      );
    },

    internal_applyPatch: async (patch) => {
      await useConfigDraftStore.getState().applyPatch(patch);
    },

    loadChannels: async () => {
      set({ isLoading: true, error: null }, false, "channels/load");
      try {
        const snapshot = await ipc.config.getSnapshot();
        set(
          (state) => ({
            channels: mapSnapshotToChannels(state.channels, snapshot.config),
            isLoading: false,
            error: null,
          }),
          false,
          "channels/load/success",
        );
      } catch (error) {
        set(
          {
            isLoading: false,
            error: error instanceof Error ? error.message : "Failed to load channels",
          },
          false,
          "channels/load/error",
        );
      }
    },

    enableChannel: async (type: ChannelType) => {
      const channel = get().channels.find((item) => item.type === type);
      if (!channel?.config) return;

      try {
        await get().internal_applyPatch({
          channels: {
            [type]: buildActualChannelPatch(type, { ...channel.config, enabled: true }),
          },
        });
        get().internal_dispatchChannels(
          (channels) =>
            channels.map((item) => (item.type === type ? { ...item, isEnabled: true } : item)),
          "channels/enable",
        );
      } catch (error) {
        set(
          { error: error instanceof Error ? error.message : "Failed to enable channel" },
          false,
          "channels/enable/error",
        );
      }
    },

    disableChannel: async (type: ChannelType) => {
      try {
        await get().internal_applyPatch({
          channels: {
            [type]: { enabled: false },
          },
        });
        get().internal_dispatchChannels(
          (channels) =>
            channels.map((item) => (item.type === type ? { ...item, isEnabled: false } : item)),
          "channels/disable",
        );
      } catch (error) {
        set(
          { error: error instanceof Error ? error.message : "Failed to disable channel" },
          false,
          "channels/disable/error",
        );
      }
    },

    configureChannel: async (type: ChannelType, config: ChannelConfig) => {
      try {
        await get().internal_applyPatch({
          channels: {
            [type]: buildActualChannelPatch(type, config),
          },
        });
        get().internal_dispatchChannels(
          (channels) =>
            channels.map((item) =>
              item.type === type
                ? {
                    ...item,
                    isConfigured: true,
                    isEnabled: config.enabled,
                    config,
                  }
                : item,
            ),
          "channels/configure",
        );
      } catch (error) {
        set(
          { error: error instanceof Error ? error.message : "Failed to configure channel" },
          false,
          "channels/configure/error",
        );
      }
    },

    setError: (error) => {
      set({ error }, false, "channels/setError");
    },
  };
}
