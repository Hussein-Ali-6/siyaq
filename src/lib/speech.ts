import { segmentSentences } from '@/lib/text/tokens';
import { normalizeWhitespace } from '@/lib/text/words';

/**
 * Reading aloud with the browser's speech synthesis. In Chrome this includes Google's own voices
 * ("Google UK English Female", "Google US English"), so no unofficial audio endpoint is needed.
 * Text is only sent to Google when the reader presses a speaker button.
 */
export type Accent = 'uk' | 'us';

export interface VoiceLike {
  name: string;
  lang: string;
}

const GOOGLE_VOICES: Record<Accent, string[]> = {
  uk: ['Google UK English Female', 'Google UK English Male'],
  us: ['Google US English'],
};
const LANG: Record<Accent, string> = { uk: 'en-gb', us: 'en-us' };

const langOf = (voice: VoiceLike) => voice.lang.toLowerCase().replace('_', '-');

/** Google's voice for the accent, else any voice for that region, else any English voice. */
export function pickVoice<T extends VoiceLike>(voices: T[], accent: Accent): T | null {
  for (const name of GOOGLE_VOICES[accent]) {
    const google = voices.find((v) => v.name === name);
    if (google) return google;
  }
  return voices.find((v) => langOf(v) === LANG[accent]) ?? voices.find((v) => langOf(v).startsWith('en')) ?? null;
}

/**
 * Splits text into pieces of at most `max` characters, at sentence ends where possible and at
 * word boundaries otherwise. Chrome's Google voices stop partway through long utterances.
 */
export function speechChunks(text: string, max = 180): string[] {
  const clean = normalizeWhitespace(text);
  if (!clean) return [];
  if (clean.length <= max) return [clean];
  const pieces: string[] = [];
  for (const span of segmentSentences(clean)) {
    const sentence = clean.slice(span.start, span.end);
    if (sentence.length <= max) {
      pieces.push(sentence);
      continue;
    }
    let line = '';
    for (const word of sentence.split(' ')) {
      if (line && line.length + 1 + word.length > max) {
        pieces.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) pieces.push(line);
  }
  const chunks: string[] = [];
  for (const piece of pieces) {
    const last = chunks[chunks.length - 1];
    if (last !== undefined && last.length + 1 + piece.length <= max) chunks[chunks.length - 1] = `${last} ${piece}`;
    else chunks.push(piece);
  }
  return chunks;
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

/** Voices load asynchronously in Chrome; wait briefly for them the first time. */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const ready = synth.getVoices();
  if (ready.length) return Promise.resolve(ready);
  voicesPromise ??= new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener('voiceschanged', done);
      const voices = synth.getVoices();
      if (!voices.length) voicesPromise = null;
      resolve(voices);
    };
    synth.addEventListener('voiceschanged', done);
    setTimeout(done, 1500);
  });
  return voicesPromise;
}

export async function speak(text: string, accent: Accent, opts: { onEnd?: () => void } = {}): Promise<void> {
  const synth = window.speechSynthesis;
  synth.cancel();
  const chunks = speechChunks(text);
  if (!chunks.length) {
    opts.onEnd?.();
    return;
  }
  const voice = pickVoice(await loadVoices(), accent);
  chunks.forEach((chunk, i) => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = accent === 'uk' ? 'en-GB' : 'en-US';
    if (voice) utterance.voice = voice;
    utterance.rate = 0.95;
    utterance.onerror = () => opts.onEnd?.();
    if (i === chunks.length - 1) utterance.onend = () => opts.onEnd?.();
    synth.speak(utterance);
  });
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}
