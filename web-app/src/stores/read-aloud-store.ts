import { create } from 'zustand'
import type { UIMessage } from 'ai'
import { useVoiceSetting } from '@/hooks/useVoiceSetting'
import { replySpeechText, speechChunks, speechText } from '@/lib/read-aloud'
import { neuralSpeechAvailable, synthesizeSpeech } from '@/lib/neural-speech'

const voiceIds = ['F1', 'F2', 'F3', 'F4', 'F5', 'M1', 'M2', 'M3', 'M4', 'M5']
type Voice = { voiceURI: string; gender: 'female' | 'male'; number: string }
type SpeechState = {
  voices: Voice[]
  activeId: string | null
  preparing: boolean
  error: 'unsupported' | 'noVoices' | 'failed' | null
  refreshVoices: () => void
  primeAudio: () => void
  read: (id: string, text: string) => Promise<boolean>
  stop: () => void
}
let generation = 0
let context: AudioContext | null = null
let source: AudioBufferSourceNode | null = null
const automaticReplies = new Map<string, string>()
const audioContext = () => context ??= new AudioContext()

export const useReadAloud = create<SpeechState>((set, get) => ({
  voices: [], activeId: null, preparing: false, error: null,
  refreshVoices: () => set({ voices: neuralSpeechAvailable()
    ? voiceIds.map((voiceURI) => ({ voiceURI, gender: voiceURI[0] === 'F' ? 'female' : 'male', number: voiceURI[1] })) : [] }),
  primeAudio: () => { if (typeof AudioContext !== 'undefined') void audioContext().resume().catch(() => {}) },
  stop: () => {
    generation++
    source?.stop()
    source = null
    set({ activeId: null, preparing: false, error: null })
  },
  read: async (id, text) => {
    get().stop()
    if (!neuralSpeechAvailable() || typeof AudioContext === 'undefined') {
      set({ error: 'unsupported' }); return false
    }
    get().refreshVoices()
    const { speechVoiceURI, speechRate, speechLanguage } = useVoiceSetting.getState()
    const voice = voiceIds.includes(speechVoiceURI ?? '') ? speechVoiceURI! : 'F1'
    const rate = Math.min(2, Math.max(0.5, speechRate))
    const chunks = speechChunks(speechText(text), 280)
    if (!chunks.length) return true
    const token = generation
    set({ activeId: id, preparing: true, error: null })
    try {
      const engine = audioContext()
      await engine.resume()
      if (token !== generation) return true
      const render = async (chunk: string) => {
        try {
          const wav = await synthesizeSpeech(chunk, speechLanguage, voice, rate)
          return { buffer: await engine.decodeAudioData(wav) }
        } catch (error) { return { error } }
      }
      let pending = render(chunks.shift()!)
      while (true) {
        const result = await pending
        if (token !== generation) return true
        if (!result.buffer) throw result.error
        // Prepare only one next chunk while the current audio is playing.
        const next = chunks.length ? render(chunks.shift()!) : null
        const playing = engine.createBufferSource()
        source = playing
        playing.buffer = result.buffer
        playing.connect(engine.destination)
        set({ preparing: false })
        await new Promise<void>((resolve) => { playing.onended = () => { playing.disconnect(); resolve() }; playing.start() })
        if (token !== generation) return true
        source = null
        if (!next) break
        pending = next
      }
      set({ activeId: null, preparing: false })
      return true
    } catch {
      if (token !== generation) return true
      source = null
      set({ activeId: null, preparing: false, error: 'failed' })
      return false
    }
  },
}))

/** Called only at final completion. Opening history never starts speech. */
export function autoReadReply(message: UIMessage): void {
  if (!useVoiceSetting.getState().autoReadReplies) return
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return
  const agent = (message.metadata as { agent_run?: { status: string } } | undefined)?.agent_run
  if (agent && agent.status !== 'finished') return
  const text = replySpeechText(message)
  if (!text || automaticReplies.get(message.id) === text) return
  automaticReplies.set(message.id, text)
  if (automaticReplies.size > 64) automaticReplies.delete(automaticReplies.keys().next().value!)
  void useReadAloud.getState().read(message.id, text)
}
