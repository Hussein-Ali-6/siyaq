# Privacy practices

Answers for the Developer Dashboard's **Privacy** tab. Each block is ready to paste into its field.
Parts marked **(ChatGPT)** apply only if the store version keeps Sign in with ChatGPT; delete them otherwise.

## Single purpose

```
Siyaq explains English text on web pages in Arabic. The reader selects a word or a sentence on a page, clicks Siyaq's button, and gets a dictionary card or a translation written for that context by the AI provider the reader connected.
```

## Permission justifications

### storage

```
Stores the reader's settings, their own AI provider API keys or sign-in tokens, the words they save, and cached answers and article summaries, so a repeated question does not call the AI provider again. Everything is kept in chrome.storage.local on the reader's device and is never synced.
```

### activeTab

```
When the reader opens the toolbar popup, Siyaq reads the active tab's address to show that page's cached article summary, and asks the page's content script for the article text when the reader requests a summary from the popup.
```

### Host permissions

The dashboard asks once for all host access. This covers `https://api.anthropic.com/*`, the optional
provider hosts, and the content script that runs on every `http` and `https` page.

```
Content script on all http and https pages: Siyaq's button has to appear next to English text the reader selects on any article or page they read, so it cannot be limited to a list of sites. The script only watches for text selections. It sends nothing until the reader clicks Siyaq's button, and it never runs in input fields or editable areas.

https://api.anthropic.com/*: the default AI provider. The service worker sends the reader's lookup to Anthropic's API with the reader's own API key.

Optional hosts (https://api.openai.com/*, https://generativelanguage.googleapis.com/*, https://openrouter.ai/*, https://auth.openai.com/*): requested at runtime only when the reader turns on OpenAI, Google Gemini, OpenRouter or Sign in with ChatGPT, so each reader grants access only to the provider they use.
```

### tabs (optional) **(ChatGPT)**

```
Requested only when the reader chooses Sign in with ChatGPT. OpenAI's sign-in ends by redirecting the sign-in tab to a loopback address (http://127.0.0.1:<port>/auth/callback), which an extension cannot listen on. Siyaq reads the address of that one sign-in tab to finish the sign-in and then closes it, ignoring every other tab. If the reader declines, they can paste the address into the settings page instead.
```

## Remote code

Choose **No, I am not using remote code**. If a justification is requested:

```
All JavaScript is bundled in the package. The extension calls AI provider APIs, which return JSON data that is validated and displayed as text; no code is downloaded or evaluated.
```

## Data usage

Tick these data types:

| Data type | Tick? | Why |
|---|---|---|
| Personally identifiable information | **(ChatGPT)** yes, otherwise no | After Sign in with ChatGPT, OpenAI returns the account's email, which is stored locally to show which account is connected. It is not sent anywhere. |
| Health information | no | |
| Financial and payment information | no | |
| Authentication information | **yes** | The reader's API keys and ChatGPT sign-in tokens are stored locally and sent only to their own provider. |
| Personal communications | no | |
| Location | no | |
| Web history | no | The page address is used only on the device, as a cache key and as a link back from a saved word. It is not sent to the AI provider. |
| User activity | no | |
| Website content | **yes** | When the reader clicks the button: the selection, the paragraph around it, the page title, the site name, and up to 4,000 words of article text for the summary go to the provider the reader chose. |

Then tick all three certifications:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

Sending the selection to the AI provider the reader chose is the extension's single purpose, which is
an approved use.

## Privacy policy URL

The policy is `store/privacy-policy.md`. It has to be on a public web page. Fill in the contact line
first, then use one of these:

- If the GitHub repo is public: the file's GitHub address,
  `https://github.com/Hussein-Ali-6/siyaq/blob/main/store/privacy-policy.md`.
- If the repo stays private: paste it into a public GitHub Gist, or a GitHub Pages site, and use that address.
