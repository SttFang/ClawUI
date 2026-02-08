import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Switch,
} from '@clawui/ui'
import { Clock, Plus, Play, Trash2, Edit } from 'lucide-react'

const cronJobs = [
  {
    id: 'daily-summary',
    name: 'Daily Summary',
    description: 'Generate a daily work summary',
    schedule: '0 9 * * *',
    enabled: true,
    lastRun: '2024-01-15T09:00:00Z',
  },
  {
    id: 'weekly-report',
    name: 'Weekly Report',
    description: 'Compile weekly progress report',
    schedule: '0 10 * * 1',
    enabled: true,
    lastRun: '2024-01-15T10:00:00Z',
  },
  {
    id: 'backup-reminder',
    name: 'Backup Reminder',
    description: 'Remind to backup important files',
    schedule: '0 18 * * 5',
    enabled: false,
    lastRun: null,
  },
]

export default function SchedulerPage() {
  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Scheduler</h1>
            <p className="text-muted-foreground">
              Schedule automated tasks for your AI assistant
            </p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        </div>

        <div className="space-y-4">
          {cronJobs.map((job) => (
            <Card key={job.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-lg">{job.name}</CardTitle>
                      <CardDescription>{job.description}</CardDescription>
                    </div>
                  </div>
                  <Switch checked={job.enabled} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    <code className="bg-muted px-2 py-1 rounded">{job.schedule}</code>
                    {job.lastRun && (
                      <span className="ml-3">
                        Last run: {new Date(job.lastRun).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Play className="w-4 h-4 mr-2" />
                      Run Now
                    </Button>
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
