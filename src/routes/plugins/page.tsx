import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Switch,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Label,
} from '@clawui/ui'
import {
  Puzzle,
  Download,
  Trash2,
  ExternalLink,
  Settings,
  Search,
  Sparkles,
  Zap,
  Link,
  Wrench,
} from 'lucide-react'
import {
  usePluginsStore,
  selectFilteredPlugins,
  selectIsLoading,
  selectSearchQuery,
  selectCategoryFilter,
  type Plugin,
  type PluginCategory,
  type PluginConfigSchema,
} from '@/store/plugins'

const categoryIcons: Record<PluginCategory, React.ReactNode> = {
  ai: <Sparkles className="w-4 h-4" />,
  productivity: <Zap className="w-4 h-4" />,
  integration: <Link className="w-4 h-4" />,
  utility: <Wrench className="w-4 h-4" />,
}

const categoryLabels: Record<PluginCategory | 'all', string> = {
  all: 'All',
  ai: 'AI',
  productivity: 'Productivity',
  integration: 'Integration',
  utility: 'Utility',
}

interface PluginConfigDialogProps {
  plugin: Plugin | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (id: string, config: Record<string, unknown>) => void
}

function PluginConfigDialog({ plugin, open, onOpenChange, onSave }: PluginConfigDialogProps) {
  const [config, setConfig] = useState<Record<string, unknown>>({})

  useEffect(() => {
    if (plugin) {
      setConfig(plugin.config || getDefaultConfig(plugin.configSchema))
    }
  }, [plugin])

  const getDefaultConfig = (schema?: PluginConfigSchema): Record<string, unknown> => {
    if (!schema) return {}
    const defaults: Record<string, unknown> = {}
    for (const [key, field] of Object.entries(schema)) {
      if (field.default !== undefined) {
        defaults[key] = field.default
      }
    }
    return defaults
  }

  const handleSave = () => {
    if (plugin) {
      onSave(plugin.id, config)
      onOpenChange(false)
    }
  }

  if (!plugin?.configSchema) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Configure {plugin.name}</DialogTitle>
          <DialogDescription>Adjust the settings for this plugin.</DialogDescription>
        </DialogHeader>
        <div className="p-6 space-y-4">
          {Object.entries(plugin.configSchema).map(([key, field]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              {field.type === 'string' && (
                <Input
                  id={key}
                  value={(config[key] as string) || ''}
                  onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                  placeholder={field.description}
                />
              )}
              {field.type === 'number' && (
                <Input
                  id={key}
                  type="number"
                  value={(config[key] as number) || ''}
                  onChange={(e) => setConfig({ ...config, [key]: Number(e.target.value) })}
                  placeholder={field.description}
                />
              )}
              {field.type === 'boolean' && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={(config[key] as boolean) || false}
                    onCheckedChange={(checked) => setConfig({ ...config, [key]: checked })}
                  />
                  {field.description && (
                    <span className="text-sm text-muted-foreground">{field.description}</span>
                  )}
                </div>
              )}
              {field.type === 'select' && field.options && (
                <select
                  id={key}
                  value={(config[key] as string) || ''}
                  onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
              {field.description && field.type !== 'boolean' && (
                <p className="text-xs text-muted-foreground">{field.description}</p>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function PluginsPage() {
  const plugins = usePluginsStore(selectFilteredPlugins)
  const isLoading = usePluginsStore(selectIsLoading)
  const searchQuery = usePluginsStore(selectSearchQuery)
  const categoryFilter = usePluginsStore(selectCategoryFilter)
  const {
    loadPlugins,
    installPlugin,
    uninstallPlugin,
    enablePlugin,
    disablePlugin,
    updatePluginConfig,
    setSearchQuery,
    setCategoryFilter,
  } = usePluginsStore()

  const [configPlugin, setConfigPlugin] = useState<Plugin | null>(null)
  const [configDialogOpen, setConfigDialogOpen] = useState(false)

  useEffect(() => {
    loadPlugins()
  }, [loadPlugins])

  const handleToggleEnabled = (plugin: Plugin) => {
    if (plugin.enabled) {
      disablePlugin(plugin.id)
    } else {
      enablePlugin(plugin.id)
    }
  }

  const handleOpenConfig = (plugin: Plugin) => {
    setConfigPlugin(plugin)
    setConfigDialogOpen(true)
  }

  const categories: (PluginCategory | 'all')[] = ['all', 'ai', 'productivity', 'integration', 'utility']

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Plugins</h1>
            <p className="text-muted-foreground">
              Extend your AI assistant with additional capabilities
            </p>
          </div>
          <Button variant="outline">
            <ExternalLink className="w-4 h-4 mr-2" />
            Browse ClawHub
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search plugins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {categories.map((category) => (
              <Button
                key={category}
                variant={categoryFilter === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategoryFilter(category)}
              >
                {category !== 'all' && categoryIcons[category]}
                <span className={category !== 'all' ? 'ml-1' : ''}>{categoryLabels[category]}</span>
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : plugins.length === 0 ? (
          <div className="text-center py-12">
            <Puzzle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No plugins found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {plugins.map((plugin) => (
              <Card key={plugin.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        {categoryIcons[plugin.category] || <Puzzle className="w-4 h-4" />}
                      </div>
                      <div>
                        <CardTitle className="text-base">{plugin.name}</CardTitle>
                        <span className="text-xs text-muted-foreground">v{plugin.version}</span>
                      </div>
                    </div>
                    {plugin.installed && (
                      <Switch
                        checked={plugin.enabled}
                        onCheckedChange={() => handleToggleEnabled(plugin)}
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <CardDescription className="flex-1 mb-4">{plugin.description}</CardDescription>
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">by {plugin.author}</p>
                    <div className="flex gap-2">
                      {plugin.installed ? (
                        <>
                          {plugin.configSchema && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => handleOpenConfig(plugin)}
                            >
                              <Settings className="w-4 h-4 mr-1" />
                              Configure
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => uninstallPlugin(plugin.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => installPlugin(plugin.id)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Install
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <PluginConfigDialog
        plugin={configPlugin}
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        onSave={updatePluginConfig}
      />
    </div>
  )
}
