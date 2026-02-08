import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Server, Plus, Settings, Trash2 } from 'lucide-react'

const mcpServers = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Access local files and directories',
    status: 'running',
    enabled: true,
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Interact with GitHub repositories',
    status: 'stopped',
    enabled: false,
  },
  {
    id: 'database',
    name: 'PostgreSQL',
    description: 'Query PostgreSQL databases',
    status: 'stopped',
    enabled: false,
  },
]

export default function MCPPage() {
  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">MCP Servers</h1>
            <p className="text-muted-foreground">
              Manage Model Context Protocol servers
            </p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Server
          </Button>
        </div>

        <div className="space-y-4">
          {mcpServers.map((server) => (
            <Card key={server.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Server className="w-5 h-5 text-muted-foreground" />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${
                          server.status === 'running'
                            ? 'bg-green-500'
                            : 'bg-gray-400'
                        }`}
                      />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{server.name}</CardTitle>
                      <CardDescription>{server.description}</CardDescription>
                    </div>
                  </div>
                  <Switch checked={server.enabled} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Settings className="w-4 h-4 mr-2" />
                    Configure
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
