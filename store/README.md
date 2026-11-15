# Chrome Web Store submission

Everything needed to publish Siyaq on the Chrome Web Store, ready to paste or upload in the
[Developer Dashboard](https://chrome.google.com/webstore/devconsole).

| File | Where it goes |
|---|---|
| `.output/siyaq-<version>-chrome.zip` (from `pnpm zip`) | **Package**: upload |
| [listing.md](listing.md) | **Store listing**: description (English and Arabic), category, language |
| `images/screenshot-1-dictionary.png` … `screenshot-5-settings.png` | **Store listing**: screenshots, 1280×800, in this order |
| `images/promo-small.png` | **Store listing**: small promo tile, 440×280 |
| `images/store-icon.png` | **Store listing**: store icon, 128×128 with transparent padding |
| [privacy-practices.md](privacy-practices.md) | **Privacy**: single purpose, permission reasons, remote code, data usage |
| [privacy-policy.md](privacy-policy.md) | Host it publicly, then paste its address in **Privacy** |

## Before submitting

1. Decide on **Sign in with ChatGPT**. OpenAI's direct sign-in is for free, open-source apps, and this repo
   has no license yet. Either publish the repo with an open-source license, or remove ChatGPT from the
   store version. If you remove it, follow the notes in `listing.md` and `privacy-practices.md`, drop
   `tabs` from `optional_permissions` in `wxt.config.ts`, and recapture `screenshot-5-settings.png`.
2. Put your contact email at the end of `privacy-policy.md` and publish it (see `privacy-practices.md`).
3. Raise `version` in `package.json` for every new upload, then run `pnpm zip`.

## Images

The screenshots use the real card, My words page and settings page with fixed answers and an original
article, so capturing them needs no API key. Sources are in `playground/store/`.

```bash
pnpm playground                 # keep it running
bash scripts/store/capture.sh   # writes store/images (needs Google Chrome)
```

The Arabic card text is written by hand. The Spanish and Chinese text is the model's own, saved in
`playground/store/live/` as it came back. To refresh it (six model calls, billed to the key in `.env`):

```bash
pnpm eval --live --only store --language es --level B2 --pick turned,meticulous --no-summary
pnpm eval --live --only store --language zh-Hans --level B2 --pick 'turned,elephant,a family bakery'
cp scripts/eval/out/cards-es-B2.json playground/store/live/es-B2.json
cp scripts/eval/out/cards-zh-hans-B2.json playground/store/live/zh-Hans-B2.json
```

Read the new answers before capturing. The summary in screenshot 3 is shorter than a real one, so that
its Chinese translation fits in the card: the English is fixed in `playground/store/fixtures.ts`, and
the Chinese is the model's translation of that paragraph.
