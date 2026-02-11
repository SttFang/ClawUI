import type { ChannelsState } from "./types";
import { defaultChannels } from "./defaultChannels";

export const initialState: ChannelsState = {
  channels: defaultChannels,
  isLoading: false,
  error: null,
};
