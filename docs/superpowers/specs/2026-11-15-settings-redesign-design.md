# Settings page redesign

Date: 15 November 2026. Branch: `settings-redesign`, on top of `store-materials`.

The user asked for the settings page to be restructured and left the design decisions to me
("do whatever you think it's better"). This file records what I decided and why, so the choices can be
reviewed and changed.

## Problems in the page as it was

1. Nothing guides a new reader. The page opens after install and does not say what to do first. With no
   key saved, Anthropic shows "Active, not set up" next to a "Used for lookups" badge.
2. The AI provider section takes half the page (about 900 of 1,800 px). The amber highlight means "the
   provider you are viewing" while a badge means "the provider in use".
3. Connecting takes six steps: pick a provider, paste the key, Save, pick a model, Use for lookups, Test.
4. The model ID box, the thinking level, Refresh list and Test connection carry the same weight as the key.
5. The key needs a Save button. Everything else saves silently, with no confirmation.
6. The level choice names B1, B2 and C1 and gives no help for choosing.
7. The text is dense: about nine sizes from 10.5 to 26 px, and Privacy is one six-line paragraph.
8. The only link to My words is a button inside the Data section.

## Goals

- A new reader knows the one thing they must do, and can do it with one button.
- A returning reader sees at a glance what is in use, and the page is short.
- Every change is confirmed in the same way.
- Nothing that works today is removed.

## Page structure

One column, 760 px wide at most, in this order:

1. **Header.** "Siyaq", "Settings", and a "My words" button on the right. Under it, one line that says
   how Siyaq is used: select English text on any page, then click the س button next to it.
2. **Setup card**, shown only when it has something to say (see below).
3. **Language and level.**
4. **AI provider.**
5. **Appearance.** One row: the label "Theme" and a Dark / Light switch.
6. **Stored answers.** What the store of answers is, how much it holds, and a button to clear it. It says
   that clearing does not delete saved words.
7. **Privacy.** The same facts as before, as a short list.

Language comes before the provider because it is already filled in from the browser's language, so the
first thing a new reader sees is their own language, chosen for them. The setup card points to the
provider, which is the only step left.

## Setup card

A pure function, `setupState(views, active)`, decides what the card shows:

| State | When | Card |
|---|---|---|
| `welcome` | No provider has a key or a sign-in | "Welcome to Siyaq": three steps. 1 Language and level, already done, showing the current choice. 2 Connect an AI provider, with a button that scrolls to that section. 3 Try it on a page. |
| `problem` | Something is saved, but lookups cannot work | "Lookups are not working", the reason in one sentence, and a button that opens that provider's row. |
| `ready` | The provider in use is ready | No card. If the page was not ready when it opened and became ready during this visit, a "You're ready" card explains how to use Siyaq, with a "Got it" button. |

The reasons for `problem` are: no model chosen, permission to reach the provider missing, and ChatGPT
signed in without plan usage.

## Language and level

- "Translate into" stays a native list with the "Other…" box. A native list has type-ahead, works with a
  keyboard and a screen reader, and 42 entries do not need more.
- The level becomes three cards, one of which is selected. Each has the name and one sentence that says
  who it is for and what the cards do at that level. The sentences follow the level rules in
  `src/lib/llm/prompts.ts`:
  - Intermediate (B1): "Everyday English is fine, but articles are hard work. Cards use very simple
    words and always restate the sentence in plainer English."
  - Upper-intermediate (B2): "You follow most articles and get stuck on idioms and less common words.
    Cards explain those in clear English."
  - Advanced (C1): "You read with ease. Cards skip what you already know and explain only rare words
    and tricky phrases."
- A line under them: "Not sure? Start with Upper-intermediate. You can change it at any time."

## AI provider

The five tiles and the separate panel become one list of rows. A row shows the provider's name, one line
about it, and its state. Clicking a row opens it in place; one row is open at a time.

**States of a row**, from a pure function `rowStatus(view, isActive)`:

| State | Text | Look |
|---|---|---|
| In use and ready | "In use" | Filled amber pill, the only filled amber on the page |
| Ready, not in use | "Connected" | Plain text with a check mark |
| Saved but not usable | "Choose a model", "Needs permission" or "Plan usage off" | Outlined |
| Nothing saved | "Not connected" | Faint text |

"Active, not set up" no longer exists. The open row has a stronger neutral border, not an amber one, so
"open" and "in use" cannot be confused. A closed row that is in use also shows its model.

**Which row is open when the page loads:** none when the provider in use is ready. Otherwise the provider
in use, so a new reader sees the key field at once.

**Connecting with a key takes one button.** An open row that is not connected shows two numbered lines
(create a key at the provider's site, paste it here), the key field, and "Connect". Connect does this:

1. Asks Chrome for permission to reach the provider (it must be the first thing in the click).
2. Saves the key.
3. If no model is chosen, loads the provider's list and chooses the recommended one.
4. Tests the connection.
5. If the provider in use is not ready, lookups switch to this one. Otherwise the row shows a
   "Use for lookups" button.

If the provider rejects the key (`bad_key`), the key that was stored before is put back, and the row
says the key was not accepted. For any other failure, such as no network, the key stays saved and the
row says the test did not pass and why. To tell the two apart, `testProvider` and `listModels` answers
gain an optional `code` field with the error code.

Steps 2 to 4 are one function, `connectWithKey`, with its storage and messaging passed in, so it is
tested without a browser.

**A connected row** shows:

- The key, masked to its last four characters, with "Replace" and "Remove". Remove asks once before it
  removes.
- The model, with "Change", which opens the searchable list. "Refresh list" and "type a model ID" are
  inside that list.
- "Use for lookups" when the row is ready and not in use.
- "Advanced", folded: the thinking level and "Test connection".

**ChatGPT** keeps its sign-in flow and its texts. After a successful sign-in the recommended model is
chosen in the same way as for a key.

**A row that needs permission** shows an "Allow access" button, which the old page did not have.

## Saving

Every setting that saves by itself (language, level, theme, model, thinking, the provider in use) shows
the same small "Saved" message at the bottom of the window for about two seconds. The key is the one
exception: "Connect" is a button because Chrome's permission request needs a click, and its result is
shown in the row.

## Text and look

- Text sizes: 12, 13, 14, 16 and 22 px only.
- Buttons and rows show a visible outline when reached with the keyboard.
- The layout works down to a narrow window: rows wrap and the level cards stack.
- Colours and components come from the existing theme, in dark and light.

## Wording changes

- "Cached answers" becomes "stored answers" in the page.
- Anthropic's line "The prompts were tuned on Claude Sonnet 5.5" becomes "Siyaq was tuned on Claude
  Sonnet 5.5".
- The Privacy facts do not change. They become a list.

## Code

| File | Change |
|---|---|
| `src/entrypoints/options/App.tsx` | New structure, header, setup card, saved message |
| `src/entrypoints/options/status.ts` (new) | `rowStatus`, `setupState`, `maskKey`: pure, tested |
| `src/entrypoints/options/connect.ts` (new) | `ensureModel`, `connectWithKey`: tested with fakes |
| `src/entrypoints/options/SetupCard.tsx` (new) | The three states of the setup card |
| `src/entrypoints/options/ProviderSection.tsx` | The list of rows, the connect flow, the folded advanced part |
| `src/entrypoints/options/ModelPicker.tsx` | Shown on "Change"; holds Refresh list and the model ID box |
| `src/entrypoints/options/ReadingSection.tsx` | Level cards |
| `src/entrypoints/options/saved-message.tsx` (new) | The shared "Saved" message |
| `src/entrypoints/options/useProviders.ts` | `statusLabel` moves to `status.ts` as `rowStatus` |
| `src/lib/messaging.ts`, `src/entrypoints/background.ts` | Optional `code` on the two answers |
| `src/lib/llm/providers.ts` | Anthropic's line |
| `src/ui/pages.css` | Keyboard outline |
| `playground/settings-stub.ts` | Scenarios for a rejected key and for missing permission |

## Not in this change

- A "follow the system" theme. It needs changes to the card on web pages.
- A custom language picker.
- The popup and the My words page.
- Hiding Sign in with ChatGPT in the store version, which is still an open decision.

## Checks

- Unit tests for `status.ts` and `connect.ts`.
- The page viewed in the playground: new install, set up, a rejected key, missing permission, ChatGPT,
  dark and light, wide and narrow.
- Store screenshot 5 recaptured.
