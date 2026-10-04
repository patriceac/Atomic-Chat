import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UIMessage } from 'ai'
import { speechChunks, speechText } from '@/lib/read-aloud'
import { useVoiceSetting } from '@/hooks/useVoiceSetting'
import { autoReadReply, useReadAloud } from './read-aloud-store'

const render = vi.hoisted(() => vi.fn())
vi.mock('@/lib/neural-speech', () => ({ neuralSpeechAvailable: () => true, synthesizeSpeech: render }))
const sources: { onended: (() => void) | null; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = []
const reply = (text: string): UIMessage => ({ id: 'reply', role: 'assistant', parts: [{ type: 'text', text }] })
vi.stubGlobal('AudioContext', class {
  destination = {}
  async resume() {}
  async decodeAudioData() { return {} }
  createBufferSource() {
    const item = { onended: null as (() => void) | null, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }
    item.stop = vi.fn(() => item.onended?.())
    sources.push(item)
    return item
  }
})

beforeEach(() => {
  useReadAloud.getState().stop()
  sources.length = 0
  render.mockReset().mockResolvedValue(new ArrayBuffer(44))
  vi.stubGlobal('navigator', { userActivation: { hasBeenActive: true } })
  useVoiceSetting.setState({ autoReadReplies: false, speechVoiceURI: null, speechRate: 1, speechLanguage: 'en' })
})

describe('local neural read aloud', () => {
  it('reads prose without code, markup or reasoning, in bounded chunks', () => {
    const text = speechText('# Hello **Patrice**\n[Visit](https://example.com)\n\x60\x60\x60js\nsecret()\n\x60\x60\x60\n<think>private</think>\nBonjour !')
    expect(text).toBe('Hello Patrice Visit Bonjour !')
    const long = (text + ' ').repeat(120).trim()
    const chunks = speechChunks(long, 280)
    expect(chunks.every((part) => part.length <= 280)).toBe(true)
    expect(chunks.join(' ')).toBe(long)
  })

  it('uses a bundled neural voice when an old Windows preference is saved', async () => {
    useVoiceSetting.setState({ speechVoiceURI: 'Old Windows voice', speechRate: 1.5, speechLanguage: 'fr' })
    const reading = useReadAloud.getState().read('reply', 'Bonjour.')
    await vi.waitFor(() => expect(sources).toHaveLength(1))
    expect(render).toHaveBeenCalledWith('Bonjour.', 'fr', 'F1', 1.5)
    expect(useReadAloud.getState().voices).toHaveLength(10)
    sources[0].onended?.()
    expect(await reading).toBe(true)
    expect(useReadAloud.getState().activeId).toBeNull()
  })

  it('cancels preparing audio and late completion cannot start playback', async () => {
    let finish: (audio: ArrayBuffer) => void = () => {}
    render.mockImplementationOnce(() => new Promise<ArrayBuffer>((resolve) => { finish = resolve }))
    const reading = useReadAloud.getState().read('old', 'A sentence. '.repeat(100))
    await vi.waitFor(() => expect(render).toHaveBeenCalledOnce())
    useReadAloud.getState().stop()
    finish(new ArrayBuffer(44))
    await reading
    expect(sources).toHaveLength(0)
    expect(useReadAloud.getState().activeId).toBeNull()
    const next = useReadAloud.getState().read('new', 'New reply.')
    await vi.waitFor(() => expect(sources).toHaveLength(1))
    expect(useReadAloud.getState().activeId).toBe('new')
    sources[0].onended?.()
    await next
  })

  it('automatically reads only enabled successful answers, once per completion', async () => {
    autoReadReply(reply('Opt-in first.'))
    expect(render).not.toHaveBeenCalled()
    useVoiceSetting.setState({ autoReadReplies: true })
    autoReadReply({ ...reply('Failed'), metadata: { agent_run: { status: 'cancelled' } } })
    autoReadReply({ ...reply('Prompt'), role: 'user' })
    expect(render).not.toHaveBeenCalled()
    autoReadReply({ ...reply('Answer.'), parts: [{ type: 'reasoning', text: 'Private.' }, { type: 'text', text: 'Answer.' }] })
    autoReadReply(reply('Answer.'))
    await vi.waitFor(() => expect(render).toHaveBeenCalledOnce())
    expect(render).toHaveBeenCalledWith('Answer.', 'en', 'F1', 1)
    useReadAloud.getState().stop()
  })
})
