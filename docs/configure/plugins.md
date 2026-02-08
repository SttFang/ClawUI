# Plugins 配置

> 来源：源码分析 (2026-02-09)

## 概述

OpenClaw Plugins 是基于 **npm 包**的工具扩展系统，提供可执行的工具函数。

与 Skills 的区别：
- **Skills**: Markdown 提示扩展，主要影响 Agent 行为
- **Plugins**: JavaScript/TypeScript 代码，提供实际可执行工具

## 目录结构

```
~/.openclaw/plugins/
├── web-search/            # npm 包结构
│   ├── package.json
│   ├── index.js
│   └── node_modules/
└── code-interpreter/
    ├── package.json
    └── index.js
```

## Plugin 定义

### package.json

```json
{
  "name": "openclaw-plugin-web-search",
  "version": "1.0.0",
  "description": "Web search plugin for OpenClaw",
  "main": "index.js",
  "openclaw": {
    "displayName": "Web Search",
    "icon": "search",
    "category": "research",
    "permissions": ["network"],
    "tools": [
      {
        "name": "web_search",
        "description": "搜索网页内容",
        "parameters": {
          "type": "object",
          "properties": {
            "query": {
              "type": "string",
              "description": "搜索关键词"
            },
            "limit": {
              "type": "number",
              "description": "结果数量",
              "default": 10
            }
          },
          "required": ["query"]
        }
      }
    ]
  }
}
```

### index.js

```javascript
// Plugin 入口
module.exports = {
  // 工具实现
  tools: {
    web_search: async ({ query, limit = 10 }) => {
      // 实现搜索逻辑
      const results = await performSearch(query, limit);
      return {
        results: results.map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet
        }))
      };
    }
  },

  // 可选：初始化函数
  async initialize(config) {
    console.log('Plugin initialized with config:', config);
  },

  // 可选：清理函数
  async cleanup() {
    console.log('Plugin cleanup');
  }
};
```

## 配置

```json5
// ~/.openclaw/openclaw.json
{
  plugins: {
    // 启用 plugins 系统
    enabled: true,

    // Plugins 目录
    directory: "~/.openclaw/plugins",

    // 已安装 plugins 设置
    installed: {
      "web-search": {
        enabled: true,
        config: {
          searchEngine: "google",
          maxResults: 20
        }
      },
      "code-interpreter": {
        enabled: true,
        config: {
          runtime: "python3",
          timeout: 30000
        }
      },
      "image-gen": {
        enabled: false  // 已安装但禁用
      }
    }
  },

  // 工具访问控制
  tools: {
    access: "ask",  // auto | ask | deny
    allow: [
      "group:fs",     // 允许文件系统工具组
      "web_*"         // 允许 web_ 前缀的工具
    ],
    deny: [
      "exec"          // 禁止执行命令
    ],
    sandbox: {
      enabled: true   // 启用沙箱执行
    }
  }
}
```

## 工具访问控制

### 访问策略

| 策略 | 说明 |
|------|------|
| `auto` | 自动执行，不询问用户 |
| `ask` | 每次执行前询问用户 |
| `deny` | 禁止执行 |

### 工具分组

```json5
{
  tools: {
    allow: [
      "group:fs",      // 文件系统操作
      "group:network", // 网络请求
      "group:exec",    // 命令执行
      "group:browser"  // 浏览器操作
    ]
  }
}
```

### 通配符匹配

```json5
{
  tools: {
    allow: [
      "web_*",         // 匹配 web_search, web_fetch 等
      "file_read",     // 精确匹配
      "*_safe"         // 匹配所有 _safe 结尾的工具
    ]
  }
}
```

## CLI 命令

```bash
# 列出已安装 plugins
openclaw plugin list

# 从 ClawHub 安装
openclaw plugin install clawhub/web-search

# 从 npm 安装
openclaw plugin install openclaw-plugin-web-search

# 从本地路径安装
openclaw plugin install ./my-plugin

# 卸载
openclaw plugin uninstall web-search

# 启用/禁用
openclaw plugin enable web-search
openclaw plugin disable web-search

# 查看详情
openclaw plugin info web-search
```

## 内置工具

OpenClaw 内置了一些常用工具：

| 工具 | 说明 | 权限 |
|------|------|------|
| file_read | 读取文件 | filesystem |
| file_write | 写入文件 | filesystem |
| file_list | 列出目录 | filesystem |
| web_fetch | HTTP 请求 | network |
| exec | 执行命令 | exec |
| browser_open | 打开浏览器 | browser |

## UI 设计参考

### Plugins 管理页面

参考已有的 `/routes/plugins/page.tsx`，添加工具权限管理：

```
┌─────────────────────────────────────────────────────────────────┐
│ 工具管理                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 访问策略                                                        │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ○ 自动执行 (不推荐)                                         │ │
│ │ ● 执行前确认 (推荐)                                         │ │
│ │ ○ 全部禁止                                                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ 工具组权限                                                      │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📁 文件系统       [允许 ▼]                                  │ │
│ │    file_read, file_write, file_list                         │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ 🌐 网络请求       [允许 ▼]                                  │ │
│ │    web_fetch, web_search                                    │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ ⚙️ 命令执行       [需确认 ▼]                                │ │
│ │    exec                                                     │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ 🌐 浏览器         [禁止 ▼]                                  │ │
│ │    browser_open                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ 安装的 Plugins                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🔍 Web Search     v1.2.0           [✓] 启用  [设置]         │ │
│ │    工具: web_search, web_fetch                              │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ 💻 Code Interpret v2.0.1           [✓] 启用  [设置]         │ │
│ │    工具: python_exec, js_exec                               │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ 🎨 Image Gen      v1.0.0           [ ] 禁用  [设置]         │ │
│ │    工具: image_generate, image_edit                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│                                      [浏览 ClawHub]             │
└─────────────────────────────────────────────────────────────────┘
```

### 工具执行确认弹窗

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ 工具执行确认                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Agent 请求执行以下操作:                                         │
│                                                                 │
│ ⚙️ exec                                                        │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ npm install express                                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ │✓│ 记住这个工具的选择                                         │
│                                                                 │
│                            [拒绝] [允许这次] [始终允许]         │
└─────────────────────────────────────────────────────────────────┘
```

## 自定义 Plugin 开发

详细开发指南请参考 OpenClaw 官方文档。
