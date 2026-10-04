import type { UIMessage } from 'ai'

/** Speak the answer, without code blocks, link targets or reasoning. */
export function speechText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)/g, '')
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/gm, '')
    .replace(/[*`~]/g, '')
    .replace(/\bhttps?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Bound each speech request and start playback before a long reply is rendered. */
export function speechChunks(text: string, limit = 500): string[] {
  const chunks: string[] = []
  let remaining = text.trim()
  while (remaining.length > limit) {
    const head = remaining.slice(0, limit)
    const sentence = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '))
    const boundary = sentence >= limit / 3 ? sentence + 1 : head.lastIndexOf(' ')
    const end = boundary > 0 ? boundary : limit
    chunks.push(remaining.slice(0, end).trim())
    remaining = remaining.slice(end).trim()
  }
  if (remaining) chunks.push(remaining)
  return chunks
}

export function replySpeechText(message: UIMessage): string {
  return message.role === 'assistant'
    ? speechText(message.parts.filter((part) => part.type === 'text').map((part) => part.text).join('\n'))
    : ''
}
