import type { PluginCategory } from '@/store/plugins'
import type { LucideIcon } from 'lucide-react'
import { Link as LinkIcon, Sparkles, Wrench, Zap } from 'lucide-react'

export const pluginCategories = ['all', 'ai', 'productivity', 'integration', 'utility'] as const

export type PluginCategoryFilter = PluginCategory | 'all'

export const categoryLabelKeys: Record<PluginCategoryFilter, string> = {
  all: 'plugins.categories.all',
  ai: 'plugins.categories.ai',
  productivity: 'plugins.categories.productivity',
  integration: 'plugins.categories.integration',
  utility: 'plugins.categories.utility',
}

export const categoryIcons: Record<PluginCategory, LucideIcon> = {
  ai: Sparkles,
  productivity: Zap,
  integration: LinkIcon,
  utility: Wrench,
}
