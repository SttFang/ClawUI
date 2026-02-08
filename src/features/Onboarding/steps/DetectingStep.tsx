import { Card, CardContent, CardHeader, CardTitle } from '@clawui/ui'
import { Loader2 } from 'lucide-react'

export function DetectingStep() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Detecting Environment</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">
            Checking Node.js and OpenClaw installation...
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
