import { invoke, isTauri } from '@tauri-apps/api/core'

export const neuralSpeechAvailable = () => typeof IS_WINDOWS !== 'undefined' && IS_WINDOWS && isTauri()

export async function synthesizeSpeech(text: string, language: string, voice: string, rate: number): Promise<ArrayBuffer> {
  const audio = await invoke<ArrayBuffer | number[]>('synthesize_speech', { text, language, voice, rate })
  return audio instanceof ArrayBuffer ? audio : new Uint8Array(audio).buffer
}
