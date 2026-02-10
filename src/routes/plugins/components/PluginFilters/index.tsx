import { Button, Input } from '@clawui/ui'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PluginCategoryFilter } from '../../constants'
import { categoryIcons, categoryLabelKeys, pluginCategories } from '../../constants'

export function PluginFilters(props: {
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  categoryFilter: PluginCategoryFilter
  onCategoryFilterChange: (category: PluginCategoryFilter) => void
}) {
  const { searchQuery, onSearchQueryChange, categoryFilter, onCategoryFilterChange } = props
  const { t } = useTranslation('common')

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t('plugins.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="pl-10"
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        {pluginCategories.map((category) => {
          const Icon = category !== 'all' ? categoryIcons[category] : null
          return (
            <Button
              key={category}
              variant={categoryFilter === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => onCategoryFilterChange(category)}
            >
              {Icon ? <Icon className="w-4 h-4" /> : null}
              <span className={category !== 'all' ? 'ml-1' : ''}>{t(categoryLabelKeys[category])}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
