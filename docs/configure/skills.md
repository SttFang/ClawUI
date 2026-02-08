# Skills 配置

> 来源：源码分析 (2026-02-09)

## 概述

OpenClaw Skills 是一种**基于 Markdown 的提示扩展系统**，通过 frontmatter 定义元数据。

与 Plugins 的区别：
- **Skills**: Markdown 文件 + Frontmatter，主要是提示/流程扩展
- **Plugins**: npm 包，提供工具函数和 API

## 目录结构

```
~/.openclaw/skills/
├── my-skill/
│   ├── SKILL.md           # 主 skill 定义
│   └── prompts/           # 可选的子提示
│       └── helper.md
└── another-skill/
    └── SKILL.md
```

## SKILL.md 格式

```markdown
---
name: my-skill
version: 1.0.0
description: 这是一个自定义 Skill
author: your-name
tags:
  - productivity
  - coding
triggers:
  - /myskill
  - when-mentioned
dependencies:
  - web-search
permissions:
  - filesystem
  - network
---

# My Skill

这里是 Skill 的主要内容，会作为系统提示的一部分。

## 用法

用户说 `/myskill` 时会触发这个 Skill。

## 工作流程

1. 第一步
2. 第二步
3. 第三步
```

### Frontmatter 字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| name | string | 是 | Skill 唯一标识 |
| version | string | 是 | 语义化版本号 |
| description | string | 是 | 简短描述 |
| author | string | 否 | 作者名 |
| tags | string[] | 否 | 分类标签 |
| triggers | string[] | 否 | 触发条件 |
| dependencies | string[] | 否 | 依赖的其他 Skills |
| permissions | string[] | 否 | 需要的权限 |

## 配置

```json5
// ~/.openclaw/openclaw.json
{
  skills: {
    // 启用/禁用 skills
    enabled: true,

    // Skills 目录 (默认 ~/.openclaw/skills)
    directory: "~/.openclaw/skills",

    // 禁用的 skills 列表
    disabled: [
      "dangerous-skill"
    ],

    // 自定义 skill 配置
    config: {
      "my-skill": {
        customOption: "value"
      }
    }
  }
}
```

## 从 ClawHub 安装

OpenClaw 提供官方 Skill 仓库 **ClawHub**，有 700+ 官方 Skills。

```bash
# 搜索 Skills
openclaw skill search "code review"

# 安装 Skill
openclaw skill install clawhub/code-review

# 列出已安装
openclaw skill list

# 卸载 Skill
openclaw skill uninstall code-review
```

## 自定义 Skill 开发

### 最小示例

```bash
mkdir -p ~/.openclaw/skills/hello-world
```

创建 `~/.openclaw/skills/hello-world/SKILL.md`:

```markdown
---
name: hello-world
version: 1.0.0
description: 简单的问候 Skill
triggers:
  - /hello
---

# Hello World Skill

当用户说 `/hello` 时，热情地问候他们！

## 响应风格

- 友好热情
- 使用 emoji
- 询问用户今天想做什么
```

### 带子提示的 Skill

```
~/.openclaw/skills/code-review/
├── SKILL.md
└── prompts/
    ├── security.md
    ├── performance.md
    └── style.md
```

SKILL.md:
```markdown
---
name: code-review
version: 2.0.0
description: 代码审查助手
triggers:
  - /review
  - /cr
---

# Code Review Skill

根据以下方面审查代码：

{{include:prompts/security.md}}
{{include:prompts/performance.md}}
{{include:prompts/style.md}}
```

## 权限说明

| 权限 | 说明 |
|------|------|
| filesystem | 文件读写 |
| network | 网络请求 |
| exec | 执行命令 |
| clipboard | 剪贴板访问 |

## UI 设计参考

### Skills 管理页面

```
┌─────────────────────────────────────────────────────────────┐
│ Skills 管理                                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ [搜索 Skills...]                     [浏览 ClawHub]         │
│                                                             │
│ 已安装 (3)                                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📝 code-review          v2.0.0                [🗑️][⚙️] │ │
│ │    代码审查助手                                         │ │
│ │    触发: /review, /cr                                  │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 🌐 web-search           v1.5.0                [🗑️][⚙️] │ │
│ │    网页搜索功能                                         │ │
│ │    触发: /search, /google                              │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 📊 data-analysis        v1.2.0   [已禁用]      [🗑️][⚙️] │ │
│ │    数据分析助手                                         │ │
│ │    触发: /analyze                                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 推荐 Skills                                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🎨 ui-designer          v3.0.0              [安装]     │ │
│ │    UI 设计助手，支持 Figma 导出                         │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 📧 email-composer       v1.8.0              [安装]     │ │
│ │    专业邮件撰写助手                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Skill 详情/配置

```
┌─────────────────────────────────────────────────────────────┐
│ ← code-review                                    [卸载]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 📝 Code Review Skill                                       │
│ v2.0.0 by clawhub-official                                 │
│                                                             │
│ 代码审查助手，自动检测安全问题、性能问题和代码风格          │
│                                                             │
│ 触发命令                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ /review  /cr                                           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 权限                                                        │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ✅ filesystem - 读取代码文件                            │ │
│ │ ⚠️ exec - 运行 lint 工具 (需确认)                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 配置                                                        │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 启用安全检查:    [✓]                                   │ │
│ │ 启用性能检查:    [✓]                                   │ │
│ │ 启用风格检查:    [✓]                                   │ │
│ │ 自定义规则文件:  [选择文件...]                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│                                        [保存配置]           │
└─────────────────────────────────────────────────────────────┘
```
