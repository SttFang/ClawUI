# AI Services Tab 重构设计

## 目标

将 AiServicesTab 从硬编码 provider 列表改为数据驱动，紧凑化布局，模型配置提升为一级 UI。

## 布局

三区块，从上到下：

1. **模型配置卡片** — 默认模型 dropdown + 回退模型内联管理
2. **Provider 认证列表** — 仅显示 `modelsStatus.auth.providers` 中的已配置 provider
3. **工具 API Key** — 保持现有 2×2 grid

## Provider 列表

- 数据源：`modelsStatus.auth.providers[]`，不再使用 `FALLBACK_PROVIDER_IDS` 硬编码
- 每行：`Name | auth-desc | status-dot`，无 icon
- 点击行展开编辑区（API key 输入 / OAuth 按钮 / 只读提示）
- OAuth 检测：`provider.profiles.oauth > 0` 或 `auth.oauth.providers` 中有对应 provider

## 模型配置卡片

合并原 `ModelConfig`（只读展示）与 `AdvancedModelConfig` 中的 fallback 管理：

- 默认模型：dropdown（从 `models:list` catalog）
- 回退模型：有序列表 + 内联 `[+]` / `[×]` 按钮
- Auth Order / Probe / OAuth Login 保持在折叠面板

## 文件改动

| 文件 | 改动 |
|------|------|
| `AiServicesTab.tsx` | 移除 fallbackProviderInfos；重构布局 |
| `ProviderCard.tsx` | 去 icon；紧凑单行+展开 |
| `ModelConfig.tsx` | 升级为合并卡片（dropdown + fallback 管理） |
| `providerRegistry.ts` | 删除 `FALLBACK_PROVIDER_IDS` |

## 不改动

- `AdvancedModelConfig`（Auth Order / Probe / OAuth Login）
- `useModelConfig` / `useAuthOrderForm` hooks
- `packages/types/src/models.ts`
- 工具 API Key 区域
