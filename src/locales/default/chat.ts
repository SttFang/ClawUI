const chat = {
  title: '对话',
  newSession: '新建会话',
  sessionList: '会话列表',
  noSessions: '暂无会话',
  scrollToLatest: '跳到最新',
  scrollToLatestAria: '滚动到最新消息',
  deleteSessionAria: '删除会话',
  generateSessionMetaAria: '生成会话简介',
  emptyTitle: '开始对话',
  emptyHintConnected: '网关已连接，发送一条消息开始。',
  emptyHintWsDisconnected: '网关正在运行，但 WebSocket 未连接。',
  emptyHintGatewayStopped: '网关未运行，请检查设置。',
  errorTitle: '错误',
  inputPlaceholder: '输入消息...',
  sendMessage: '发送',
  attachFile: '添加附件',
  removeAttachment: '移除附件',
} as const

export default chat
