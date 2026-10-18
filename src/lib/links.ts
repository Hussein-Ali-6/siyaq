/** YouGlish: real videos of people saying the word or phrase. */
export function youglishUrl(phrase: string): string {
  return `https://youglish.com/pronounce/${encodeURIComponent(phrase.trim())}/english`;
}

/** Oxford Learner's Dictionaries (free), which also has British and American audio. */
export function oxfordUrl(headword: string): string {
  return `https://www.oxfordlearnersdictionaries.com/search/english/?q=${encodeURIComponent(headword.trim())}`;
}
