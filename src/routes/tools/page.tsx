import { useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
} from '@clawui/ui'
import {
  Shield,
  ShieldCheck,
  ShieldQuestion,
  ShieldX,
  FileText,
  Globe,
  Terminal,
  Database,
  Image,
} from 'lucide-react'
import {
  useToolsStore,
  selectTools,
  selectAccessMode,
  selectToolsConfig,
  selectIsLoading,
  type ToolAccessMode,
} from '@/store/tools'

const accessModes: {
  value: ToolAccessMode
  label: string
  description: string
  icon: React.ReactNode
}[] = [
  {
    value: 'auto',
    label: 'Auto',
    description: 'Automatically allow safe tools',
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    value: 'ask',
    label: 'Ask',
    description: 'Ask before using any tool',
    icon: <ShieldQuestion className="h-5 w-5" />,
  },
  {
    value: 'deny',
    label: 'Deny',
    description: 'Deny all tool access by default',
    icon: <ShieldX className="h-5 w-5" />,
  },
]

const categoryIcons: Record<string, React.ReactNode> = {
  filesystem: <FileText className="h-5 w-5" />,
  web: <Globe className="h-5 w-5" />,
  command: <Terminal className="h-5 w-5" />,
  database: <Database className="h-5 w-5" />,
  media: <Image className="h-5 w-5" />,
}

export default function ToolsPage() {
  const tools = useToolsStore(selectTools)
  const accessMode = useToolsStore(selectAccessMode)
  const config = useToolsStore(selectToolsConfig)
  const isLoading = useToolsStore(selectIsLoading)

  const loadTools = useToolsStore((s) => s.loadTools)
  const setAccessMode = useToolsStore((s) => s.setAccessMode)
  const enableTool = useToolsStore((s) => s.enableTool)
  const disableTool = useToolsStore((s) => s.disableTool)
  const toggleSandbox = useToolsStore((s) => s.toggleSandbox)

  useEffect(() => {
    loadTools()
  }, [loadTools])

  const handleToolToggle = (toolId: string, enabled: boolean) => {
    if (enabled) {
      enableTool(toolId)
    } else {
      disableTool(toolId)
    }
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Tools</h1>
          <p className="text-muted-foreground">
            Configure which tools your AI assistant can use
          </p>
        </div>

        {/* Access Mode */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <CardTitle>Access Control</CardTitle>
            </div>
            <CardDescription>
              Choose how the AI should request tool permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {accessModes.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setAccessMode(mode.value)}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    accessMode === mode.value
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {mode.icon}
                    <span className="font-medium">{mode.label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{mode.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sandbox Mode */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Sandbox Mode</CardTitle>
            <CardDescription>
              Run tools in an isolated environment for added security
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Enable Sandbox</p>
                <p className="text-sm text-muted-foreground">
                  Recommended for untrusted operations
                </p>
              </div>
              <Switch checked={config.sandboxEnabled} onCheckedChange={toggleSandbox} />
            </div>
          </CardContent>
        </Card>

        {/* Tool List */}
        <Card>
          <CardHeader>
            <CardTitle>Available Tools</CardTitle>
            <CardDescription>Enable or disable individual tools</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tools.map((tool) => (
              <div
                key={tool.id}
                className="flex items-center justify-between p-4 rounded-lg border"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-muted">
                    {categoryIcons[tool.category] || <Shield className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{tool.name}</span>
                      {tool.requiresConfirmation && (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-500">
                          Requires confirmation
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{tool.description}</p>
                  </div>
                </div>
                <Switch
                  checked={tool.enabled}
                  onCheckedChange={(checked) => handleToolToggle(tool.id, checked)}
                  disabled={isLoading}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
