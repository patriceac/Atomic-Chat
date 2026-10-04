import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTextToSpeech, loadVoiceStyle, writeWavFile } from './supertonic.mjs';

// Private stdio worker owned by Atomic Chat. No HTTP listener or cloud calls.
const root = path.dirname(fileURLToPath(import.meta.url));
const engine = loadTextToSpeech(path.join(root, 'onnx'), {
  executionProviders: ['cpu'], intraOpNumThreads: 2, interOpNumThreads: 1,
});
engine.catch(() => {}); // Report startup errors through the request pipe.
const voices = new Map();
for await (const line of createInterface({ input: process.stdin })) {
  try {
    const { text, language, voice, rate } = JSON.parse(line);
    if (typeof text !== 'string' || !text.trim() || text.length > 300
      || !['en', 'fr'].includes(language) || !/^[FM][1-5]$/.test(voice)
      || !Number.isFinite(rate) || rate < 0.5 || rate > 2) throw new Error('Invalid speech request');
    const { textToSpeech: tts } = await engine;
    if (!voices.has(voice)) voices.set(voice,
      await loadVoiceStyle([path.join(root, 'voice_styles', `${voice}.json`)]));
    const { wav, duration } = await tts.call(text, language, voices.get(voice), 10, rate);
    if (!Number.isFinite(duration[0]) || duration[0] <= 0 || duration[0] > 60
      || wav.some(value => !Number.isFinite(value))) throw new Error('Invalid generated audio');
    const audio = writeWavFile(wav.slice(0, Math.floor(duration[0] * tts.sampleRate)), tts.sampleRate);
    process.stdout.write(JSON.stringify({ audio: Buffer.from(audio).toString('base64') }) + '\n');
  } catch (error) {
    process.stdout.write(JSON.stringify({ error: error.message }) + '\n');
  }
}
// The parent closing its input pipe also closes this worker and its model cache.
process.exit(0);
