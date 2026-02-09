import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Switch } from '@clawui/ui'
import { Download, Puzzle, Settings, Trash2 } from 'lucide-react'
import type { Plugin } from '@/store/plugins'
import { categoryIcons } from '../../constants'

export function PluginGrid(props: {
  plugins: Plugin[]
  onToggleEnabled: (plugin: Plugin) => void
  onInstall: (id: string) => void
  onUninstall: (id: string) => void
  onOpenConfig: (plugin: Plugin) => void
}) {
  const { plugins, onToggleEnabled, onInstall, onUninstall, onOpenConfig } = props

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {plugins.map((plugin) => {
        const Icon = categoryIcons[plugin.category]
        return (
          <Card key={plugin.id} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {Icon ? <Icon className="w-4 h-4" /> : <Puzzle className="w-4 h-4" />}
                  </div>
                  <div>
                    <CardTitle className="text-base">{plugin.name}</CardTitle>
                    <span className="text-xs text-muted-foreground">v{plugin.version}</span>
                  </div>
                </div>
                {plugin.installed ? (
                  <Switch checked={plugin.enabled} onCheckedChange={() => onToggleEnabled(plugin)} />
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <CardDescription className="flex-1 mb-4">{plugin.description}</CardDescription>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">by {plugin.author}</p>
                <div className="flex gap-2">
                  {plugin.installed ? (
                    <>
                      {plugin.configSchema ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => onOpenConfig(plugin)}
                        >
                          <Settings className="w-4 h-4 mr-1" />
                          Configure
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onUninstall(plugin.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" className="w-full" onClick={() => onInstall(plugin.id)}>
                      <Download className="w-4 h-4 mr-2" />
                      Install
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

