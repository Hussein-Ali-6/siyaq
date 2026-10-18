import { oxfordUrl, youglishUrl } from '@/lib/links';
import { ExternalIcon, VideoIcon } from './icons';

const linkClass =
  'inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-muted no-underline hover:bg-surface-2 hover:text-text';

/** Opens the headword on YouGlish (real videos) and Oxford Learner's Dictionaries, in new tabs. */
export function LookupLinks({ headword }: { headword: string }) {
  return (
    <span className="inline-flex items-center">
      <a href={youglishUrl(headword)} target="_blank" rel="noopener noreferrer" className={linkClass} title="Hear it in real videos on YouGlish">
        <VideoIcon className="h-3.5 w-3.5" />
        YouGlish
      </a>
      <a href={oxfordUrl(headword)} target="_blank" rel="noopener noreferrer" className={linkClass} title="Open in Oxford Learner's Dictionaries">
        <ExternalIcon className="h-3.5 w-3.5" />
        Oxford
      </a>
    </span>
  );
}
