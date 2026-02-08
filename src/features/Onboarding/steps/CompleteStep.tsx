import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@clawui/ui'
import { CheckCircle2, Rocket } from 'lucide-react'

interface CompleteStepProps {
  onComplete: () => void
}

export function CompleteStep({ onComplete }: CompleteStepProps) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-green-500/10 p-3">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
          </div>
          <CardTitle className="text-2xl">You're All Set!</CardTitle>
          <CardDescription>
            OpenClaw has been configured successfully. You're ready to start chatting
            with AI assistants.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" size="lg" onClick={onComplete}>
            <Rocket className="mr-2 h-5 w-5" />
            Launch ClawUI
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
