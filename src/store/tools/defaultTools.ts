import type { Tool } from "./types";

export const defaultTools: Tool[] = [
  {
    id: "group:fs",
    name: "File Operations",
    description: "read/write/edit/apply_patch file operations",
    category: "group",
    enabled: true,
    requiresConfirmation: false,
  },
  {
    id: "group:web",
    name: "Web Operations",
    description: "web_search and web_fetch operations",
    category: "group",
    enabled: true,
    requiresConfirmation: false,
  },
  {
    id: "group:runtime",
    name: "Runtime Operations",
    description: "exec and process runtime operations",
    category: "group",
    enabled: true,
    requiresConfirmation: true,
  },
  {
    id: "group:sessions",
    name: "Session Operations",
    description: "session listing/history/send/spawn/status operations",
    category: "group",
    enabled: false,
    requiresConfirmation: false,
  },
  {
    id: "group:memory",
    name: "Memory Operations",
    description: "memory search and retrieval operations",
    category: "group",
    enabled: false,
    requiresConfirmation: false,
  },
];
