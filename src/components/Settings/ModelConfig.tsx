import { Card, CardContent, CardHeader, CardTitle } from '@clawui/ui'
import { Cpu, ArrowDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ModelConfigProps {
  defaultModel: string
  fallbacks: string[]
}

export function ModelConfig({ defaultModel, fallbacks }: ModelConfigProps) {
  const { t } = useTranslation('common')

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5" />
          <CardTitle>{t('settings.modelConfig.title')}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{t('settings.modelConfig.defaultModel')}</p>
          <p className="font-mono text-sm font-medium">{defaultModel}</p>
        </div>
        {fallbacks.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{t('settings.modelConfig.fallbacks')}</p>
            <div className="space-y-1">
              {fallbacks.map((fb, i) => (
                <div key={fb} className="flex items-center gap-2">
                  <ArrowDown className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono text-sm">
                    {i + 1}. {fb}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('settings.modelConfig.fallbackHint')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
