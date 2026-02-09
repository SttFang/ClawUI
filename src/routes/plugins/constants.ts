import type { PluginCategory } from '@/store/plugins'
import type { LucideIcon } from 'lucide-react'
import { Link as LinkIcon, Sparkles, Wrench, Zap } from 'lucide-react'

export const pluginCategories = ['all', 'ai', 'productivity', 'integration', 'utility'] as const

export type PluginCategoryFilter = PluginCategory | 'all'

export const categoryLabels: Record<PluginCategoryFilter, string> = {
  all: 'All',
  ai: 'AI',
  productivity: 'Productivity',
  integration: 'Integration',
  utility: 'Utility',
}

export const categoryIcons: Record<PluginCategory, LucideIcon> = {
  ai: Sparkles,
  productivity: Zap,
  integration: LinkIcon,
  utility: Wrench,
}

