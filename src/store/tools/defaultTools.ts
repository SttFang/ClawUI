import type { Tool } from "./types";

export const defaultTools: Tool[] = [
  {
    id: "fs",
    name: "File System",
    description: "Read, write, and manage files on the system",
    category: "filesystem",
    enabled: true,
    requiresConfirmation: false,
  },
  {
    id: "web",
    name: "Web Access",
    description: "Browse websites and fetch web content",
    category: "web",
    enabled: true,
    requiresConfirmation: false,
  },
  {
    id: "bash",
    name: "Command Execution",
    description: "Execute shell commands and scripts",
    category: "command",
    enabled: true,
    requiresConfirmation: true,
  },
  {
    id: "database",
    name: "Database",
    description: "Query and manage database connections",
    category: "database",
    enabled: false,
    requiresConfirmation: true,
  },
  {
    id: "media",
    name: "Media Processing",
    description: "Process images, audio, and video files",
    category: "media",
    enabled: false,
    requiresConfirmation: false,
  },
];
