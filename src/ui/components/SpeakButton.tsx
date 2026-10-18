import { useState } from 'react';
import { canSpeak, speak, stopSpeaking, type Accent } from '@/lib/speech';
import { SpeakerIcon } from './icons';

const ACCENT_NAME: Record<Accent, string> = { uk: 'British', us: 'American' };

/** Reads `text` aloud in a British or American voice; pressing again stops it. */
export function SpeakButton({ text, accent, label }: { text: string; accent: Accent; label?: string }) {
  const [playing, setPlaying] = useState(false);
  if (!canSpeak()) return null;
  const title = `Listen (${ACCENT_NAME[accent]})`;
  const onClick = () => {
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    void speak(text, accent, { onEnd: () => setPlaying(false) });
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={playing}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tracking-wide ${
        playing ? 'bg-amber-soft text-amber' : 'text-muted hover:bg-surface-2 hover:text-text'
      }`}
    >
      <SpeakerIcon className="h-3.5 w-3.5" />
      {label && <span>{label}</span>}
    </button>
  );
}
