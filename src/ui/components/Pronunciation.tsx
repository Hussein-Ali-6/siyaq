import { SpeakButton } from './SpeakButton';

const Ipa = ({ value }: { value: string }) => <span className="font-ipa text-[13.5px] text-muted">/{value}/</span>;

/** British and American IPA, each with a speaker. One IPA line when both accents agree. */
export function Pronunciation({ text, ipaUk, ipaUs }: { text: string; ipaUk?: string; ipaUs?: string }) {
  if (ipaUk && ipaUk === ipaUs) {
    return (
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <Ipa value={ipaUk} />
        <SpeakButton text={text} accent="uk" label="UK" />
        <SpeakButton text={text} accent="us" label="US" />
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="inline-flex items-center gap-1">
        <SpeakButton text={text} accent="uk" label="UK" />
        {ipaUk && <Ipa value={ipaUk} />}
      </span>
      <span className="inline-flex items-center gap-1">
        <SpeakButton text={text} accent="us" label="US" />
        {ipaUs && <Ipa value={ipaUs} />}
      </span>
    </div>
  );
}
