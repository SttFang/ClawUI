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
  plugins: {
    title: '插件',
    description: '为你的 AI 助手扩展更多能力',
    browseClawHub: '浏览 ClawHub',
    searchPlaceholder: '搜索插件...',
    emptyTitle: '未找到插件',
    emptyDescription: '试试调整搜索关键词或筛选条件',
    byAuthor: '作者：{{author}}',
    actions: {
      configure: '配置',
      install: '安装',
    },
    config: {
      title: '配置 {{name}}',
      description: '调整该插件的设置。',
    },
    categories: {
      all: '全部',
      ai: 'AI',
      productivity: '效率',
      integration: '集成',
      utility: '工具',
    },
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
