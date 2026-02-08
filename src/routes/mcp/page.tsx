import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Switch,
} from '@clawui/ui'
import {
  Server,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Terminal,
  Wrench,
  AlertCircle,
} from 'lucide-react'
import {
  useMCPStore,
  selectServers,
  selectIsLoading,
  selectError,
  selectExpandedServerId,
} from '@/store/mcp'
import { AddMCPServerDialog } from './AddMCPServerDialog'

export default function MCPPage() {
  const servers = useMCPStore(selectServers)
  const isLoading = useMCPStore(selectIsLoading)
  const error = useMCPStore(selectError)
  const expandedServerId = useMCPStore(selectExpandedServerId)

  // Use stable action references to avoid infinite re-renders in React 19
  const loadServers = useMCPStore((s) => s.loadServers)
  const addServer = useMCPStore((s) => s.addServer)
  const removeServer = useMCPStore((s) => s.removeServer)
  const toggleServer = useMCPStore((s) => s.toggleServer)
  const setExpandedServer = useMCPStore((s) => s.setExpandedServer)

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  useEffect(() => {
    loadServers()
  }, [loadServers])

  const handleAddServer = async (serverData: {
    name: string
    command: string
    args: string[]
    env?: Record<string, string>
    enabled: boolean
  }) => {
    await addServer(serverData)
    setIsAddDialogOpen(false)
  }

  const handleDeleteServer = async (id: string) => {
    await removeServer(id)
    setDeleteConfirmId(null)
  }

  const handleToggleExpand = (id: string) => {
    setExpandedServer(expandedServerId === id ? null : id)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-400'
    }
  }

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
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Server
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <span className="text-destructive">{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : servers.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Server className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No MCP Servers</h3>
                <p className="text-muted-foreground mb-4">
                  Add your first MCP server to extend the AI capabilities
                </p>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Server
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {servers.map((server) => (
              <Card key={server.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div
                      className="flex items-center gap-3 flex-1 cursor-pointer"
                      onClick={() => handleToggleExpand(server.id)}
                    >
                      <div className="relative">
                        <Server className="w-5 h-5 text-muted-foreground" />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${getStatusColor(server.status)}`}
                        />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{server.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Terminal className="w-3 h-3" />
                          <code className="text-xs">
                            {server.command} {server.args.join(' ')}
                          </code>
                        </CardDescription>
                      </div>
                      {expandedServerId === server.id ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <Switch
                        checked={server.enabled}
                        onCheckedChange={() => toggleServer(server.id)}
                      />
                    </div>
                  </div>
                </CardHeader>

                {expandedServerId === server.id && (
                  <CardContent>
                    <div className="space-y-4">
                      {/* Environment Variables */}
                      {server.env && Object.keys(server.env).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">
                            Environment Variables
                          </h4>
                          <div className="bg-muted rounded-lg p-3 space-y-1">
                            {Object.entries(server.env).map(([key, value]) => (
                              <div
                                key={key}
                                className="font-mono text-xs flex gap-2"
                              >
                                <span className="text-primary">{key}</span>
                                <span className="text-muted-foreground">=</span>
                                <span className="text-foreground">
                                  {String(value).length > 20
                                    ? `${String(value).slice(0, 20)}...`
                                    : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tools */}
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Wrench className="w-4 h-4" />
                          Tools ({server.tools.length})
                        </h4>
                        {server.tools.length > 0 ? (
                          <div className="grid gap-2">
                            {server.tools.map((tool) => (
                              <div
                                key={tool.name}
                                className="bg-muted rounded-lg p-3"
                              >
                                <div className="font-medium text-sm">
                                  {tool.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {tool.description}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Tools will be discovered when the server starts
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t">
                        {deleteConfirmId === server.id ? (
                          <>
                            <span className="text-sm text-muted-foreground">
                              Delete this server?
                            </span>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteServer(server.id)}
                            >
                              Confirm
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirmId(server.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <AddMCPServerDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSubmit={handleAddServer}
      />
    </div>
  )
}
