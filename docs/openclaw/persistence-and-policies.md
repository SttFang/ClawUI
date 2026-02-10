# OpenClaw 持久化 Schema 与策略（身份/渠道/权限/拓展/定时任务/Skills）

> 目标：给 ClawUI 做 Gateway 管理面板时，明确 OpenClaw “哪些数据落在哪里、格式是什么、怎么迁移/写入”，避免只改 `openclaw.json` 但漏掉 `credentials/`、`sessions.json`、`cron/jobs.json` 等导致行为不一致。

## 0. 总览：两类持久化

OpenClaw 的持久化大体分两类：

- **配置型持久化（Config）**：`$OPENCLAW_STATE_DIR/openclaw.json`（JSON5）
  - 典型内容：渠道账号配置、路由 bindings、工具/技能开关、插件开关与插件配置。
- **状态型持久化（State）**：`$OPENCLAW_STATE_DIR/**`（JSON/JSON5/目录）
  - 典型内容：会话索引 `sessions.json`、会话 transcript `*.jsonl`、OAuth/渠道凭证 `credentials/`、cron 任务 `cron/jobs.json`、插件安装目录 `extensions/`、技能目录 `skills/` 等。

> **重要**：备份/迁移时不能只拷 `openclaw.json`，必须拷整个 `$OPENCLAW_STATE_DIR`（OpenClaw 官方文档也强调这一点）。

## 1. 状态目录与路径解析（State Dir / Config Path）

### 1.1 State Dir 解析规则

- 默认状态目录：`~/.openclaw`
- 可通过环境变量覆盖：
  - `OPENCLAW_STATE_DIR`
  -（兼容）`CLAWDBOT_STATE_DIR`

源码入口：

- `../openclaw/src/config/paths.ts`：`resolveStateDir()` / `resolveConfigPathCandidate()` / `resolveOAuthDir()` 等
- `../openclaw/src/utils.ts`：`CONFIG_DIR`（用于一部分模块的默认落盘目录）

### 1.2 Config Path 解析规则

- canonical：`$OPENCLAW_STATE_DIR/openclaw.json`
- 可通过环境变量覆盖：
  - `OPENCLAW_CONFIG_PATH`
  -（兼容）`CLAWDBOT_CONFIG_PATH`

源码入口：`../openclaw/src/config/paths.ts`

### 1.3 文件权限策略（安全默认）

很多敏感落盘文件会写成 `0600`（仅当前用户可读写），目录通常为 `0700`：

- 会话 store `sessions.json` 写入时强制 `chmod 0600`（并带 `.lock` 文件锁）
  - `../openclaw/src/config/sessions/store.ts`
- `device.json` / `device-auth.json` / `devices/*.json` 等也会写 `0600`
  - `../openclaw/src/infra/device-identity.ts`
  - `../openclaw/src/infra/device-auth-store.ts`
  - `../openclaw/src/infra/device-pairing.ts`

## 2. 身份信息（Identity）

这里的“身份”不是传统多租户用户系统（OpenClaw 是 local-first 单控制平面），而是：

- Gateway 的 **device identity（密钥对 + deviceId）**
- Node/客户端配对（pairing）与 token
- 会话 key 构造相关的 **accountId / identityLinks**（用于把不同渠道的同一“人”合并/隔离会话）

### 2.1 Device Identity（设备身份）

落盘：

- `$OPENCLAW_STATE_DIR/identity/device.json`

Schema（概念）：

```json
{
  "version": 1,
  "deviceId": "...sha256...",
  "publicKeyPem": "-----BEGIN PUBLIC KEY-----...",
  "privateKeyPem": "-----BEGIN PRIVATE KEY-----...",
  "createdAtMs": 1700000000000
}
```

策略要点：

- 不存在/损坏则自动生成（ed25519）
- 会校验 publicKey 派生出的 `deviceId`，不一致时会自动修复并回写

源码入口：`../openclaw/src/infra/device-identity.ts`

### 2.2 Device Auth Tokens（设备 token）

落盘：

- `$OPENCLAW_STATE_DIR/identity/device-auth.json`

Schema（概念）：

```json
{
  "version": 1,
  "deviceId": "...",
  "tokens": {
    "admin": { "token": "...", "role": "admin", "scopes": ["..."], "updatedAtMs": 1700000000000 }
  }
}
```

策略要点：

- 以 `role` 为 key 存储 token（同 role 会覆盖更新）
- scopes 会去重并排序
- 写入带 `0600`

源码入口：`../openclaw/src/infra/device-auth-store.ts`

### 2.3 Device Pairing（配对请求/已配对设备）

落盘：

- `$OPENCLAW_STATE_DIR/devices/pending.json`（短 TTL 的待批准请求）
- `$OPENCLAW_STATE_DIR/devices/paired.json`（已配对设备与 token）

策略要点：

- pending 具有 TTL（过期会被清理）
- 写入为原子写（tmp → rename）+ `0600`
- 内部使用 async lock 串行化写入

源码入口：`../openclaw/src/infra/device-pairing.ts`

### 2.4 identityLinks / accountId（会话归并策略）

这部分通常是**配置型持久化**（`openclaw.json`），影响：

- DM 会话 key 的隔离粒度（per-peer / per-channel-peer / per-account-channel-peer 等）
- 多渠道身份归并（把不同 provider 的 peerId 映射到同一个 canonical id）

源码入口（会话 key 构造）：

- `../openclaw/src/routing/session-key.ts`
- `../openclaw/src/routing/resolve-route.ts`

## 3. 渠道管理（Channels）

### 3.1 渠道配置（openclaw.json）

渠道账号/路由/策略主要在 `openclaw.json` 下：

- `channels.<channelId>...`
- 多账号模式常见结构：`channels.<id>.accounts.<accountId>...`
- 路由：`bindings[]`（把 inbound 的 channel/account/peer/guild 等路由到 agentId）

（ClawUI 做渠道管理 UI 时，基本都在这层做 CRUD。）

### 3.2 渠道凭证与登录态（credentials/）

OpenClaw 把 OAuth token、渠道登录态、pairing allowlists 等放在 credentials 目录：

- credentials dir：
  - 默认：`$OPENCLAW_STATE_DIR/credentials`
  - 可覆盖：`OPENCLAW_OAUTH_DIR`

源码入口：`../openclaw/src/config/paths.ts`（`resolveOAuthDir()`）

#### 3.2.1 WhatsApp Web（示例：最典型的“目录式凭证”）

默认账号落盘（示例）：

- `$OPENCLAW_STATE_DIR/credentials/whatsapp/default/creds.json`
- `$OPENCLAW_STATE_DIR/credentials/whatsapp/default/creds.json.bak`

策略要点：

- 读 creds.json 时会做 JSON parse 校验；损坏时尝试从 `.bak` 恢复
- logout 会删除对应 authDir（或清理 legacy 格式文件）

源码入口：

- `../openclaw/src/web/auth-store.ts`
- `../openclaw/src/web/accounts.ts`（解析 accountId → authDir）

> 其他渠道也会在 `credentials/<channel>/...` 下落盘各自的 token/offset/cache；具体以插件实现为准。

### 3.3 渠道配对（Pairing）与动态 allowFrom（权限相关，但存于 credentials）

OpenClaw 的“配对码/allowFrom 动态批准”落盘在 credentials 下（每个 channel 单独一个文件）：

- pairing requests：
  - `$OPENCLAW_STATE_DIR/credentials/<channel>-pairing.json`
- pairing allowFrom store：
  - `$OPENCLAW_STATE_DIR/credentials/<channel>-allowFrom.json`

策略要点：

- 文件锁：`proper-lockfile`（避免多进程并发写）
- pending 有 TTL 与最大条数裁剪
- allowFrom 会做 normalize（不同 channel 可能有不同 normalize 逻辑）

源码入口：`../openclaw/src/pairing/pairing-store.ts`

## 4. 权限管理（Permissions）

OpenClaw 的“权限”主要体现在三层：

1. **渠道准入**（DM/group 是否接受、允许哪些 sender）
2. **工具准入**（tools allow/deny、sandbox policy）
3. **高风险行为准入**（exec approvals、elevated mode）

### 4.1 渠道准入（dmPolicy / groupPolicy / allowFrom）

渠道侧一般通过 `openclaw.json` 的策略字段实现：

- `channels.<id>.dmPolicy` + `allowFrom`
- 群组策略与群组 allowFrom

并且可配合 `credentials/<channel>-allowFrom.json` 的 pairing allowFrom 动态批准（见 3.3）。

相关实现与审计点：

- `../openclaw/src/security/audit.ts`（会检查 allowFrom wildcard、过宽策略等）
- `../openclaw/src/channels/dock.ts`（把 allowFrom 格式化成 UI/CLI 可读结构）

### 4.2 Exec Approvals（命令执行审批）

这是权限管理里**最“独立成体系”的持久化**，不放在 `openclaw.json`，而是单独文件：

- approvals file：`~/.openclaw/exec-approvals.json`（可配置 socket）
- approvals socket：`~/.openclaw/exec-approvals.sock`

Schema（概念）：

```json
{
  "version": 1,
  "socket": { "path": "~/.openclaw/exec-approvals.sock", "token": "..." },
  "defaults": { "security": "deny", "ask": "on-miss", "askFallback": "deny", "autoAllowSkills": false },
  "agents": {
    "main": {
      "security": "allowlist",
      "ask": "on-miss",
      "allowlist": [{ "id": "...", "pattern": "git status", "lastUsedAt": 1700000000000 }]
    }
  }
}
```

策略要点：

- allowlist entry 会被“修复”成对象数组，并补齐 `id`
- 会把 legacy `agents.default` 合并到 `agents.main`
- 写入强制 `0600`

源码入口：`../openclaw/src/infra/exec-approvals.ts`

## 5. 拓展管理（Extensions / Plugins）

OpenClaw 的拓展系统是“插件 + manifest + 配置”的组合：

### 5.1 插件安装目录（可持久化）

默认安装目录：

- `$OPENCLAW_STATE_DIR/extensions/<pluginId>/...`

源码入口：

- `../openclaw/src/plugins/install.ts`（install/update，安全扫描，写入 extensions 目录）
- `../openclaw/src/plugins/discovery.ts`（发现 bundled/config/workspace/extra paths 的候选插件）

### 5.2 插件 manifest（schema + capabilities）

每个插件目录下的 manifest：

- `openclaw.plugin.json`

包含：

- `id`
- `configSchema`（JSON schema / TypeBox 风格，用于校验 `plugins.entries.<id>.config`）
- `channels` / `providers` / `skills`（声明插件提供的集成点）

源码入口：`../openclaw/src/plugins/manifest.ts`

### 5.3 插件配置持久化（openclaw.json）

插件开关与配置在 `openclaw.json`：

- `plugins.enabled`
- `plugins.allow[]` / `plugins.deny[]`
- `plugins.load.paths[]`（额外扫描路径）
- `plugins.slots.*`（例如 memory slot）
- `plugins.entries.<pluginId>.enabled`
- `plugins.entries.<pluginId>.config`（会按 manifest 的 `configSchema` 校验）

相关实现：

- `../openclaw/src/plugins/config-state.ts`（normalize + enable/disable 解析）
- `../openclaw/src/plugins/loader.ts`（真正加载/注册）

### 5.4 插件服务的 stateDir 注入

插件 services 在 start/stop 时会拿到：

- `stateDir: STATE_DIR`（来自 `src/config/paths.ts` 的 resolveStateDir）

源码入口：`../openclaw/src/plugins/services.ts`

## 6. 定时任务管理（Cron）

### 6.1 Cron store 位置与格式

默认落盘：

- `$OPENCLAW_STATE_DIR/cron/jobs.json`

Schema（概念）：

```json
{
  "version": 1,
  "jobs": [
    {
      "id": "...",
      "name": "every 5m ping",
      "enabled": true,
      "schedule": { "kind": "every", "everyMs": 300000, "anchorMs": 1700000000000 },
      "payload": { "kind": "agentTurn", "message": "..." },
      "delivery": { "mode": "announce", "channel": "telegram", "to": "..." },
      "sessionTarget": "isolated",
      "state": { "nextRunAtMs": 1700000000000 }
    }
  ]
}
```

源码入口：

- `../openclaw/src/cron/store.ts`（`DEFAULT_CRON_STORE_PATH` / load/save / `.bak`）

### 6.2 迁移与规范化策略（非常关键）

Cron store 读取后会做“就地修复 + 回写 persist”，包括：

- legacy 字段迁移（`provider` → `channel` 等）
- payload kind 规范化（大小写、缺省推断）
- schedule 规范化（`atMs` → ISO `at`、补 `anchorMs`）
- delivery mode 规范化（`deliver` → `announce`、缺省显式持久化）
- 自动补齐 `name` / `description` / `enabled` 等

源码入口：`../openclaw/src/cron/service/store.ts`

## 7. Skills 管理（目录/配置/扫描/优先级）

### 7.1 Skills 目录来源与优先级（决定“同名 skill 覆盖”）

OpenClaw 会从多个目录加载 skills，并按优先级合并（同名后者覆盖前者）：

1. **extra**（最低优先级）：`skills.load.extraDirs[]` + plugin 声明的 skill dirs
2. **bundled**：随 OpenClaw 发布包内置的 skills
3. **managed**：`$OPENCLAW_STATE_DIR/skills`
4. **workspace**（最高优先级）：`<workspaceDir>/skills`

源码入口：

- `../openclaw/src/agents/skills/workspace.ts`（load + merge precedence）
- `../openclaw/src/agents/skills/plugin-skills.ts`（插件提供 skills dirs）

### 7.2 Skills 配置持久化（openclaw.json）

所有 skill 配置集中在 `openclaw.json` 的 `skills` 下：

- `skills.entries.<skillKey>.enabled`
- `skills.entries.<skillKey>.apiKey`
- `skills.entries.<skillKey>.env`
- `skills.entries.<skillKey>.config`
- `skills.allowBundled[]`（仅影响 bundled skills）
- `skills.load.extraDirs[]`
- `skills.load.watch` / `skills.load.watchDebounceMs`

类型定义：`../openclaw/src/config/types.skills.ts`

### 7.3 Skill 的“可用性判定”策略（Eligibility）

OpenClaw 会基于 skill frontmatter 里的 metadata，以及当前运行环境来决定是否加载：

- OS 限制（`metadata.os`）
- 依赖二进制（`metadata.requires.bins` / `anyBins`）
- 依赖 env（`metadata.requires.env`，允许由 `skills.entries.<skillKey>.env`/`apiKey` 提供）
- 依赖 config path（`metadata.requires.config`，例如要求某个插件/工具开关为 true）
- bundled allowlist（`skills.allowBundled`）

实现入口：`../openclaw/src/agents/skills/config.ts`

### 7.4 Skill frontmatter 与 skillKey

skill 的“配置 key”默认是 skill folder name，但可以被 frontmatter 的 metadata 显式覆盖：

- `metadata.skillKey`

解析入口：

- `../openclaw/src/agents/skills/frontmatter.ts`（解析 frontmatter + metadata + invocation policy）

### 7.5 安全扫描（Skill Scanner）

OpenClaw 对 skills/插件源代码有“轻量规则扫描”（warn-only，不会阻断安装），并在 `security audit --deep` 中用于增强审计。

源码入口：`../openclaw/src/security/skill-scanner.ts`

## 8. ClawUI 落地建议（管理面板的“真相源”）

建议把 OpenClaw 的持久化拆成三个面板级别的“真相源”：

- **配置源**：`openclaw.json`（配置编辑 UI）
- **状态源**：
  - `agents/<agentId>/sessions/sessions.json` + `agents/<agentId>/sessions/*.jsonl`
  - `cron/jobs.json`
  - `devices/*.json`、`identity/*.json`
  - `exec-approvals.json`
- **凭证源**：`credentials/**`

UI 上最容易踩坑的是：

- 只改 `openclaw.json` 但用户期望“登录态/配对/allowFrom”也一起变化
- 切 profile/切 `OPENCLAW_STATE_DIR` 后，dashboard/ClawUI 显示的是另一个 stateDir 的数据
- 迁移只拷 config 没拷 `credentials/` 与 `agents/*/sessions/`

## 参考（DeepWiki/源码）

- DeepWiki：`https://deepwiki.com/openclaw/openclaw`
  - Channels / Access Control / Skills / Plugins / Node pairing 等章节可在左侧目录跳转
- 源码（本机）：
  - 身份：`../openclaw/src/infra/device-identity.ts`、`../openclaw/src/infra/device-pairing.ts`
  - 渠道凭证：`../openclaw/src/config/paths.ts`、`../openclaw/src/web/auth-store.ts`、`../openclaw/src/pairing/pairing-store.ts`
  - 权限：`../openclaw/src/infra/exec-approvals.ts`、`../openclaw/src/security/audit.ts`
  - 插件：`../openclaw/src/plugins/*`
  - cron：`../openclaw/src/cron/*`
  - skills：`../openclaw/src/agents/skills/*`

