import { useEffect } from 'react'
import { IconVolume, IconPlayerStopFilled, IconLoader2 } from '@tabler/icons-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { useReadAloud } from '@/stores/read-aloud-store'
import { speechText } from '@/lib/read-aloud'

export function ReadAloudButton({ id, text }: { id: string; text: string }) {
  const { t } = useTranslation()
  const active = useReadAloud((state) => state.activeId === id)
  const preparing = useReadAloud((state) => state.activeId === id && state.preparing)
  const refreshVoices = useReadAloud((state) => state.refreshVoices)
  useEffect(() => { refreshVoices() }, [refreshVoices])
  if (!speechText(text)) return null
  const label = t(active ? 'chat:readAloud.stop' : 'chat:readAloud.start')
  return (
    <Button variant="ghost" size="icon-xs" title={label} aria-label={label}
      onClick={() => {
        const state = useReadAloud.getState()
        if (active) state.stop()
        else void state.read(id, text).then((success) => {
          const error = useReadAloud.getState().error
          if (!success && error) toast.error(t(`settings:readAloud.${error}`))
        })
      }}>
      {preparing ? <IconLoader2 size={16} className="animate-spin" /> : active ? <IconPlayerStopFilled size={16} /> : <IconVolume size={16} />}
    </Button>
  )
}
