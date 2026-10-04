import { useEffect } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Card, CardItem } from '@/containers/Card'
import { ReadAloudButton } from '@/containers/ReadAloudButton'
import { useVoiceSetting } from '@/hooks/useVoiceSetting'
import { useReadAloud } from '@/stores/read-aloud-store'
import { useTranslation } from '@/i18n/react-i18next-compat'

export function ReadAloudSettings() {
  const { t } = useTranslation()
  const { autoReadReplies, setAutoReadReplies, speechVoiceURI, setSpeechVoiceURI, speechRate, setSpeechRate, speechLanguage, setSpeechLanguage } = useVoiceSetting()
  const voices = useReadAloud((state) => state.voices)
  const error = useReadAloud((state) => state.error)
  const refreshVoices = useReadAloud((state) => state.refreshVoices)
  useEffect(() => { refreshVoices() }, [refreshVoices])
  const voice = voices.find((v) => v.voiceURI === speechVoiceURI) ?? voices[0]
  const voiceName = (v: (typeof voices)[number]) => t(`settings:readAloud.${v.gender}`, { number: v.number })
  const rowClass = 'flex-wrap gap-3 [&>div:first-child]:min-w-0 [&>div:first-child]:flex-1'
  return (
    <Card title={t('settings:readAloud.title')}>
      <p className="mb-4">{t('settings:readAloud.description')}</p>
      <CardItem title={t('settings:readAloud.automatic')} className={rowClass}
        actions={<Switch aria-label={t('settings:readAloud.automatic')} checked={autoReadReplies} disabled={!voices.length}
          onCheckedChange={(value) => { setAutoReadReplies(value); if (value) useReadAloud.getState().primeAudio(); else useReadAloud.getState().stop() }} />} />
      <CardItem title={t('settings:readAloud.language')} className={rowClass} actions={
        <select aria-label={t('settings:readAloud.language')} value={speechLanguage}
          className="rounded-md border border-input bg-background px-3 py-2 text-foreground"
          onChange={(event) => { setSpeechLanguage(event.target.value as 'en' | 'fr'); useReadAloud.getState().stop() }}>
          <option value="en">{t('settings:readAloud.english')}</option>
          <option value="fr">{t('settings:readAloud.french')}</option>
        </select>
      } />
      <CardItem title={t('settings:readAloud.voice')} column actions={
        <DropdownMenu><DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full min-w-0 justify-between" disabled={!voices.length}>
            <span className="min-w-0 truncate">{voice ? voiceName(voice) : t('settings:readAloud.systemVoice')}</span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0" />
          </Button>
        </DropdownMenuTrigger><DropdownMenuContent className="max-w-[min(28rem,80vw)]">
          {voices.map((v) => <DropdownMenuItem key={v.voiceURI} onClick={() => { setSpeechVoiceURI(v.voiceURI); useReadAloud.getState().stop() }}>
            <span className="min-w-0 truncate">{voiceName(v)}</span>
          </DropdownMenuItem>)}
        </DropdownMenuContent></DropdownMenu>
      } />
      <CardItem title={t('settings:readAloud.speed')} className={rowClass} actions={
        <select aria-label={t('settings:readAloud.speed')} value={speechRate}
          className="rounded-md border border-input bg-background px-3 py-2 text-foreground"
          onChange={(event) => { setSpeechRate(Number(event.target.value)); useReadAloud.getState().stop() }}>
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => <option key={rate} value={rate}>{rate}×</option>)}
        </select>
      } />
      <CardItem title={t('settings:readAloud.preview')} className={rowClass} actions={
        <ReadAloudButton id="speech-preview" text={t(`settings:readAloud.${speechLanguage === 'fr' ? 'previewTextFrench' : 'previewTextEnglish'}`)} />
      } />
      {(error || !voices.length) && <p role="status" className="mt-3 text-sm">{t(`settings:readAloud.${error ?? 'noVoices'}`)}</p>}
    </Card>
  )
}
