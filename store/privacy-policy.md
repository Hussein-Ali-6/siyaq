# Siyaq privacy policy

Effective 15 November 2026.

Siyaq is a Chrome extension that explains English text on web pages, with a translation into the
language you choose. It has no server and no account. Its developer does not receive, see or store any
of your data.

## What stays on your device

These are kept in Chrome's local extension storage on your computer. They are not synced to other
devices and are not sent to the developer.

- Your settings: your translation language, your English level, the AI provider you chose, its model
  and thinking level, and the theme.
- Your API keys, and, if you use Sign in with ChatGPT, your sign-in tokens and the email address of the
  ChatGPT account, which is shown on the settings page.
- The words and sentences you save, with the sentence, page title and page address they came from.
- Cached answers and article summaries, so asking the same thing again does not call the AI provider.

## What is sent, and when

Nothing leaves your browser until you click Siyaq's button next to a selection. Then Siyaq sends the
following to the AI provider you connected (Anthropic, OpenAI, Google Gemini, OpenRouter, or OpenAI
through Sign in with ChatGPT), using your own API key or sign-in:

- the text you selected, and the paragraph around it (up to about 400 words);
- the page title and the site name;
- the article summary, once one exists;
- the name of your translation language, as listed or as you typed it, and your English level.

The first card you open on a page also asks the same provider for a short summary of the article. For
that, Siyaq sends the article's main text (up to 4,000 words), the page title, the site name and the
name of your translation language. The same happens when you ask for a summary from the toolbar button.

Siyaq does not send the page address, your browsing history, other tabs, or anything from input fields.

Each provider handles what it receives under its own terms and privacy policy, which decide, for
example, how long it is kept and whether it may be used to improve its models. Some free plans allow
that. See:

- Anthropic: https://www.anthropic.com/legal/privacy
- OpenAI and ChatGPT: https://openai.com/policies/privacy-policy
- Google Gemini: https://ai.google.dev/gemini-api/terms
- OpenRouter: https://openrouter.ai/privacy

## Other services you can choose to use

- **Speech.** Pressing a speaker button uses Chrome's built-in speech. Chrome's Google voices send the
  word or sentence to Google to turn it into audio.
- **Links.** The YouGlish and Oxford Learner's Dictionaries links open those sites in a new tab, with the
  word in the address.
- **Sign in with ChatGPT.** Signing in takes place on OpenAI's site. Siyaq reads the address of that one
  sign-in tab to finish signing in, then closes it.

## What Siyaq does not do

- No analytics, advertising or tracking.
- No selling or sharing of your data, and no use of it for anything other than explaining the text you
  ask about.
- No logging of page text or answers. The browser console only ever shows event names, error codes and
  counts.

## Deleting your data

- Delete saved words on the My words page.
- Clear cached answers and summaries on the settings page.
- Remove a key, or sign out of ChatGPT, on the settings page.
- Uninstalling Siyaq deletes everything it stored.

Data already sent to an AI provider is governed by that provider's policy.

## Children

Siyaq is not directed at children under 13.

## Changes

If this policy changes, the new version will be published at this address with a new effective date.

## Contact

For questions about this policy or about Siyaq, open an issue at
https://github.com/Hussein-Ali-6/siyaq/issues
