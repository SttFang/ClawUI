export interface ToolCredentialDef {
  toolId: string;
  label: string;
  configPath: string;
  envFallback?: string;
  placeholder?: string;
}

export const TOOL_CREDENTIAL_DEFS: ToolCredentialDef[] = [
  {
    toolId: "web_search_brave",
    label: "Brave Search",
    configPath: "tools.web.search.apiKey",
    envFallback: "BRAVE_API_KEY",
    placeholder: "BSA...",
  },
  {
    toolId: "web_search_perplexity",
    label: "Perplexity",
    configPath: "tools.web.search.perplexity.apiKey",
    envFallback: "PERPLEXITY_API_KEY",
    placeholder: "pplx-...",
  },
  {
    toolId: "web_search_grok",
    label: "Grok (xAI)",
    configPath: "tools.web.search.grok.apiKey",
    envFallback: "XAI_API_KEY",
    placeholder: "xai-...",
  },
  {
    toolId: "web_fetch_firecrawl",
    label: "Firecrawl",
    configPath: "tools.web.fetch.firecrawl.apiKey",
    envFallback: "FIRECRAWL_API_KEY",
    placeholder: "fc-...",
  },
];
