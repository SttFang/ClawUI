import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ChannelsStore } from "./types";
import { createChannelsActions } from "./actions";
import { initialState } from "./initialState";

export const useChannelsStore = create<ChannelsStore>()(
  devtools(
    (set, get) => ({
      ...initialState,
      ...createChannelsActions(set, get),
    }),
    { name: "ChannelsStore" },
  ),
);
