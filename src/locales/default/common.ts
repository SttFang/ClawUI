const common = {
  actions: {
    newSession: '新建会话',
    cancel: '取消',
    confirm: '确认',
    save: '保存',
    delete: '删除',
    edit: '编辑',
    close: '关闭',
  },
  navigation: {
    toggleSidebar: '切换侧边栏',
    goBack: '后退',
    goForward: '前进',
  },
  status: {
    loading: '加载中...',
    saving: '保存中...',
    error: '出错了',
    success: '成功',
  },
  connection: {
    error: '错误',
    offline: '离线',
    starting: '启动中',
    connected: '已连接',
    connecting: '连接中',
  },
  configBanner: {
    title: '未配置 API Key',
    description: '要开始对话，你需要配置 AI 提供商（Anthropic、OpenAI 等）的 API Key。',
    oneClick: '一键配置',
    manual: '手动配置',
  },
  language: {
    manage: '语言',
    current: '当前语言',
    system: '跟随系统',
    zhCN: '中文（简体）',
    enUS: '英语（美国）',
  },
} as const

export default common
