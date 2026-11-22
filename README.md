# HoodTalk

A funny AI slang translator. Type literally anything and hear it back in
Hood Talk, Gangster, OG, Funny Hood, Crash-Out, Savage, Street Poet, or
Authentic — with an intensity slider from slight slang (1) to completely
unhinged (10).

- **$0, offline, no APIs, no accounts, no tracking.** Everything runs
  on-device in the browser. The "AI" is a rule-based transformation engine.
  Hood Talk (the flagship voice) is an intent-aware sentence rewriter:
  it reads what the sentence is trying to do (ask permission, ask a
  favor, state something, greet, plan, thank, apologize, say goodbye)
  and rebuilds it as natural conversation, preserving the meaning. v1.4
  rewrote it in a full Blood-style gangsta voice (on-set energy,
  rotating openers/closers, tiered intensity, no overused fillers). v1.5
  added **NO FUCKS GIVEN** — a toggleable unleashed Hood Talk voice
  (foul-mouthed, savage, zero filter; Hood Talk only, off by default).
  The other 7 personalities use lexicon swaps + openers/closers/fillers.
  Intensity scales everything. v1.2 added Fluent English (a writing
  mode: Correct Only / Polish It / Professional, with a Why? explanation
  for every fix). v1.3 added Say It Back (paste what someone said, get 3
  reply options back in your voice). No API keys exist to expose.
- Static site: `index.html` + `styles.css` + `app.js` + `icons/` +
  `manifest.webmanifest`. No build step.
- Add to Home Screen: the PWA manifest and `apple-touch-icon` are set so
  iOS shows **HoodTalk** with its own purple speech-bubble mark — no
  wrapper branding.

## Features (v1.5)

- **Translator (Home):** large text box, 8 personalities, intensity slider
  1–10, Translate button. Every translation returns **3 different
  variations**; each result has Copy, Regenerate, Save to favorites,
  Hear It (browser `speechSynthesis`, pitch/rate per personality), and
  Translate Back to normal English.
- **NO FUCKS GIVEN (Home + Settings):** a clearly labeled toggle that
  unleashes Hood Talk's strongest voice — reckless, unapologetic,
  foul-mouthed, savage comebacks, dark humor, zero filter. Default OFF,
  persisted in settings. It only ever affects Hood Talk (translator +
  Say It Back Hood Talk replies); the other 7 personalities and Fluent
  English are completely untouched. The savagery is intent-fit by
  design: an insult gets a ruthless comeback, a question gets an answer
  with attitude (not an attack on the asker), a greeting gets hyped up,
  a request gets a bold yes/no with flavor. Never threats — comedic
  roasts of the situation only, never violence/doxxing/harassment aimed
  at a real person (tested explicitly). The intensity slider still works
  with NFG on (higher = harder, filthier, more outrageous).

- **Translator (Home):** large text box, 8 personalities, intensity slider
  1–10, Translate button. Every translation returns **3 different
  variations**; each result has Copy, Regenerate, Save to favorites,
  Hear It (browser `speechSynthesis`, pitch/rate per personality), and
  Translate Back to normal English.
- **Fluent English (Home mode switch):** a first-class writing mode,
  picked instead of a slang personality — never both at once. Fixes
  spelling, commonly confused words (their/there/they're, your/you're,
  its/it's, to/too/two, then/than, could of → could've…), punctuation,
  grammar, capitalization, verb tense, and voice-to-text mess (spoken
  "comma"/"period", run-on "and then" chains). Three options: **Correct
  Only** (minimal fixes), **Polish It** (cleaner flow, same voice),
  **Professional** (formal wording for work). Intentional casual language
  (gonna, yeah, lol, slang, fragments) is left alone in Correct Only and
  Polish It. Every result has a **Why?** toggle listing each correction
  and the reason, plus Copy, Regenerate, Save, and Hear It.
- **Say It Back:** paste what someone just said, get **3 reply options**
  back in your voice (Hood Talk by default, other personalities
  available). The engine detects the incoming message — question,
  greeting, compliment, insult/diss, joke, request, venting, flirting,
  thanks, apology, goodbye — and the replies actually answer it: a
  question gets an answer, a diss gets a funny clapback (never a real
  threat), a greeting gets a greeting back. Each reply has its own flavor
  label (Confident / Funny / Short & smooth for Hood Talk) plus Copy,
  Regenerate (fresh options for the same input), and Save. Replies are
  voiced through the reworked Hood Talk engine and never invent facts
  (no made-up times or promises).
- **Modes:** personality browser — one-line description + example per
  personality, with a "Use" button that switches the translator to it.
  Fluent English and Say It Back have their own cards at the top.
- **History:** last 50 translations in localStorage; load back into the
  translator, copy, or delete. Fluent English and Say It Back exchanges
  are stored too, marked with their mode.
- **Favorites:** saved results, with copy, hear-it, and remove.
  Fluent English and Say It Back saves are marked with their mode.
- **Randomizer:** a 🎲 button that drops a random hood-talk phrase from a
  48-phrase bank covering all 8 personalities.
- **Settings:** default mode (Slang / Fluent English), default
  personality, default intensity, clear history, clear favorites, reset
  settings, about. Every button does something real.

## Structure

- `index.html` — all five tabs (Home, Modes, History, Favorites,
  Settings) + bottom tab bar.
- `app.js` — the translation engine (lexicon, personalities, intensity
  scaling, translate-back, randomizer), history/favorites storage logic,
  and the browser UI. Pure functions are exported for node tests.
- `styles.css` — dark charcoal theme, neon purple + green.
- `icons/icon-180.png` (apple-touch-icon), `icon-192.png`, `icon-512.png`
  — drawn by `scripts/make_icons.py` (PIL).
- `tests/test.js` — node unit tests. `tests/` has no UI test; the jsdom
  UI smoke test lives in `/tmp` (ephemeral) and is re-created when needed.

## Run locally

```sh
python3 -m http.server 8123
# open http://localhost:8123/
```

## Tests

```sh
node tests/test.js
```

92 unit tests, all passing. Covers: every personality × every input type
(statement, question, work message, request, insult, long paragraph);
variation distinctness; intensity 1 vs 10 flavour difference (incl.
Crash-Out all-caps at 10); translate-back plainness (strips slang, keeps
content words); the brief's coffee example per personality; Hood Talk v3
golden examples (Blood-style on-set voice: intent coverage, meaning
preserved, voice present, variety, intensity tiers 2 vs 5 vs 9, no banned
filler, new thanks/apology/goodbye/plans/feeling intents); NFG mode
(OFF clean, ON stronger + savage comebacks, meaning preserved, no threat
patterns, variety, Hood Talk only); Fluent English (confused words,
grammar, spelling, voice-to-text run-ons, casual language preserved in
Correct Only/Polish, Professional formality, explanations list real
corrections, output stays close to input); Say It Back (intent detection
across 12 message types; 3 distinct, labeled, responsive, in-voice
replies per type; no invented times in question replies; repeated
generation varies; other personalities work); history/favorites pure
logic (incl. mode-marked entries); randomizer variety; personality
metadata completeness.

UI smoke test (jsdom, ephemeral, re-created when needed):
`node /tmp/hoodtalk-ui-smoke.js` — 53 checks, all passing. Covers boot
(chips, defaults, version), NFG toggle (present on Home + Settings,
off by default, synced both ways, ON changes translations, OFF restores),
slang translate (3 cards), Fluent English mode switch + fix + Why? box,
Say It Back panel (3 labeled replies, regenerate, back), history mode
labels, Modes tab cards.

## Deploy

GitHub Pages from `main` (static site, no build step). Repo:
DevilInTheComments/hoodtalk → https://devilinthecomments.github.io/hoodtalk/

## Deliberately left for later

- Full voice personalities (per-personality TTS voices beyond pitch/rate)
  — v1's Hear It button uses the browser's built-in speech synthesis.
- Sharing translations as images, daily phrase notifications, and any
  server-side features (accounts, sync) — all would break the $0/offline
  constraint and need a separate decision.
