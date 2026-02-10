const chat = {
  title: "Chat",
  newSession: "New session",
  sessionList: "Sessions",
  noSessions: "No sessions yet",
  sessionFilters: {
    ui: "UI",
    discord: "Discord",
    all: "All",
  },
  scrollToLatest: "Jump to latest",
  scrollToLatestAria: "Scroll to latest message",
  deleteSessionAria: "Delete session",
  generateSessionMetaAria: "Generate session summary",
  emptyTitle: "Start a conversation",
  emptyHintConnected: "Gateway connected. Send a message to begin.",
  emptyHintWsDisconnected: "Gateway is running but WebSocket is not connected.",
  emptyHintGatewayStopped: "Gateway is not running. Please check settings.",
  errorTitle: "Error",
  inputPlaceholder: "Type a message...",
  sendMessage: "Send",
  attachFile: "Attach file",
  removeAttachment: "Remove attachment",
  createSessionHint: "Create a session to start chatting.",
} as const;

export default chat;
