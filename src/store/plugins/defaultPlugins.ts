import type { Plugin } from "./types";

export const defaultPlugins: Plugin[] = [
  {
    id: "web-search",
    name: "Web Search",
    description: "Enable AI to search the web for real-time information",
    version: "1.0.0",
    author: "OpenClaw",
    enabled: true,
    installed: true,
    category: "ai",
    configSchema: {
      searchEngine: {
        type: "select",
        label: "Search Engine",
        description: "Default search engine to use",
        default: "google",
        options: [
          { label: "Google", value: "google" },
          { label: "Bing", value: "bing" },
          { label: "DuckDuckGo", value: "duckduckgo" },
        ],
      },
      maxResults: {
        type: "number",
        label: "Max Results",
        description: "Maximum number of search results to return",
        default: 10,
      },
    },
    config: {
      searchEngine: "google",
      maxResults: 10,
    },
  },
  {
    id: "code-interpreter",
    name: "Code Interpreter",
    description: "Execute Python code in a sandboxed environment",
    version: "1.2.0",
    author: "OpenClaw",
    enabled: false,
    installed: true,
    category: "ai",
    configSchema: {
      timeout: {
        type: "number",
        label: "Execution Timeout",
        description: "Maximum execution time in seconds",
        default: 30,
      },
      allowNetworkAccess: {
        type: "boolean",
        label: "Allow Network Access",
        description: "Allow code to make network requests",
        default: false,
      },
    },
    config: {
      timeout: 30,
      allowNetworkAccess: false,
    },
  },
  {
    id: "notion-sync",
    name: "Notion Sync",
    description: "Sync conversations and notes with Notion",
    version: "0.9.0",
    author: "Community",
    enabled: false,
    installed: false,
    category: "integration",
    configSchema: {
      apiKey: {
        type: "string",
        label: "Notion API Key",
        description: "Your Notion integration API key",
        required: true,
      },
      databaseId: {
        type: "string",
        label: "Database ID",
        description: "Notion database ID for syncing",
      },
    },
  },
  {
    id: "image-generation",
    name: "Image Generation",
    description: "Generate images using DALL-E, Stable Diffusion, and more",
    version: "2.0.0",
    author: "OpenClaw",
    enabled: false,
    installed: false,
    category: "ai",
    configSchema: {
      provider: {
        type: "select",
        label: "Default Provider",
        default: "dalle",
        options: [
          { label: "DALL-E 3", value: "dalle" },
          { label: "Stable Diffusion", value: "sd" },
          { label: "Midjourney", value: "mj" },
        ],
      },
    },
  },
  {
    id: "github-integration",
    name: "GitHub Integration",
    description: "Connect to GitHub repositories, create issues, and manage PRs",
    version: "1.5.0",
    author: "OpenClaw",
    enabled: false,
    installed: false,
    category: "integration",
    configSchema: {
      token: {
        type: "string",
        label: "GitHub Token",
        description: "Personal access token with repo permissions",
        required: true,
      },
    },
  },
  {
    id: "markdown-export",
    name: "Markdown Export",
    description: "Export conversations to Markdown files",
    version: "1.0.0",
    author: "Community",
    enabled: true,
    installed: true,
    category: "productivity",
    configSchema: {
      includeMetadata: {
        type: "boolean",
        label: "Include Metadata",
        description: "Include timestamps and model info in exports",
        default: true,
      },
    },
    config: {
      includeMetadata: true,
    },
  },
  {
    id: "voice-input",
    name: "Voice Input",
    description: "Use voice commands and speech-to-text input",
    version: "0.8.0",
    author: "Community",
    enabled: false,
    installed: false,
    category: "utility",
    configSchema: {
      language: {
        type: "select",
        label: "Language",
        default: "en-US",
        options: [
          { label: "English (US)", value: "en-US" },
          { label: "English (UK)", value: "en-GB" },
          { label: "Spanish", value: "es-ES" },
          { label: "Chinese (Simplified)", value: "zh-CN" },
        ],
      },
    },
  },
  {
    id: "pomodoro-timer",
    name: "Pomodoro Timer",
    description: "Built-in productivity timer with focus sessions",
    version: "1.1.0",
    author: "Community",
    enabled: false,
    installed: false,
    category: "productivity",
    configSchema: {
      workDuration: {
        type: "number",
        label: "Work Duration (minutes)",
        default: 25,
      },
      breakDuration: {
        type: "number",
        label: "Break Duration (minutes)",
        default: 5,
      },
    },
  },
];
