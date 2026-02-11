import { createWeakCachedSelector } from "@/store/utils/createWeakCachedSelector";
import type { ChannelType, ChannelsStore } from "./types";

export const selectChannels = (state: ChannelsStore) => state.channels;
export const selectEnabledChannels = createWeakCachedSelector((state: ChannelsStore) =>
  state.channels.filter((channel) => channel.isEnabled),
);
export const selectConfiguredChannels = createWeakCachedSelector((state: ChannelsStore) =>
  state.channels.filter((channel) => channel.isConfigured),
);
export const selectChannelByType = (type: ChannelType) => (state: ChannelsStore) =>
  state.channels.find((channel) => channel.type === type);

export const channelsSelectors = {
  selectChannels,
  selectEnabledChannels,
  selectConfiguredChannels,
  selectChannelByType,
};
