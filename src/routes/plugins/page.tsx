import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Puzzle, Download, Trash2, ExternalLink } from 'lucide-react'

const plugins = [
  {
    id: 'web-search',
    name: 'Web Search',
    description: 'Search the web using various search engines',
    installed: true,
    enabled: true,
    version: '1.2.0',
  },
  {
    id: 'code-interpreter',
    name: 'Code Interpreter',
    description: 'Execute Python code in a sandbox',
    installed: true,
    enabled: true,
    version: '2.0.1',
  },
  {
    id: 'image-gen',
    name: 'Image Generation',
    description: 'Generate images using AI models',
    installed: false,
    enabled: false,
    version: '1.0.0',
  },
]

export default function PluginsPage() {
  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
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

        <div className="space-y-4">
          {plugins.map((plugin) => (
            <Card key={plugin.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Puzzle className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{plugin.name}</CardTitle>
                        <span className="text-xs text-muted-foreground">
                          v{plugin.version}
                        </span>
                      </div>
                      <CardDescription>{plugin.description}</CardDescription>
                    </div>
                  </div>
                  {plugin.installed ? (
                    <Switch checked={plugin.enabled} />
                  ) : (
                    <Button size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Install
                    </Button>
                  )}
                </div>
              </CardHeader>
              {plugin.installed && (
                <CardContent>
                  <Button variant="outline" size="sm" className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Uninstall
                  </Button>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
