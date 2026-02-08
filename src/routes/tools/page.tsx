import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
  Button,
} from '@clawui/ui'
import { Shield, FileText, Globe, Terminal, Database, Image } from 'lucide-react'

const toolGroups = [
  {
    id: 'fs',
    name: 'File System',
    description: 'Read, write, and manage files',
    icon: FileText,
    enabled: true,
  },
  {
    id: 'web',
    name: 'Web Access',
    description: 'Browse and fetch web content',
    icon: Globe,
    enabled: true,
  },
  {
    id: 'exec',
    name: 'Command Execution',
    description: 'Run shell commands',
    icon: Terminal,
    enabled: false,
  },
  {
    id: 'db',
    name: 'Database',
    description: 'Query and modify databases',
    icon: Database,
    enabled: false,
  },
  {
    id: 'media',
    name: 'Media Processing',
    description: 'Process images and media',
    icon: Image,
    enabled: true,
  },
]

export default function ToolsPage() {
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
            <div className="flex gap-2">
              <Button variant="outline">Auto</Button>
              <Button variant="default">Ask</Button>
              <Button variant="outline">Deny</Button>
            </div>
          </CardContent>
        </Card>

        {/* Tool Groups */}
        <div className="space-y-4">
          {toolGroups.map((group) => (
            <Card key={group.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <group.icon className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-lg">{group.name}</CardTitle>
                      <CardDescription>{group.description}</CardDescription>
                    </div>
                  </div>
                  <Switch checked={group.enabled} />
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
