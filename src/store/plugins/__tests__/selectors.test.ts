import { describe, it, expect, beforeEach } from "vitest";
import {
  usePluginsStore,
  selectFilteredPlugins,
  selectInstalledPlugins,
  selectEnabledPlugins,
  type Plugin,
} from "../index";

const initialState = {
  plugins: [
    {
      id: "a",
      name: "Alpha",
      description: "First plugin",
      version: "1.0.0",
      author: "test",
      enabled: true,
      installed: true,
      category: "ai",
    },
    {
      id: "b",
      name: "Beta",
      description: "Second plugin",
      version: "1.0.0",
      author: "test",
      enabled: false,
      installed: false,
      category: "utility",
    },
  ] as Plugin[],
  isLoading: false,
  error: null as string | null,
  searchQuery: "",
  categoryFilter: "all" as const,
};

describe("Plugins selectors (React 19 snapshot stability)", () => {
  beforeEach(() => {
    // Reset store state before each test; keep actions intact.
    usePluginsStore.setState(initialState);
  });

  it("selectFilteredPlugins should return stable reference for same state object", () => {
    const state = usePluginsStore.getState();
    const a = selectFilteredPlugins(state);
    const b = selectFilteredPlugins(state);
    expect(a).toBe(b);
  });

  it("selectInstalledPlugins should return stable reference for same state object", () => {
    const state = usePluginsStore.getState();
    const a = selectInstalledPlugins(state);
    const b = selectInstalledPlugins(state);
    expect(a).toBe(b);
  });

  it("selectEnabledPlugins should return stable reference for same state object", () => {
    const state = usePluginsStore.getState();
    const a = selectEnabledPlugins(state);
    const b = selectEnabledPlugins(state);
    expect(a).toBe(b);
  });
});
