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
  reply options back in your voice). v1.6 added **Dad Talk** — a private
  space for dads to start, keep, and repair conversations with their
  kids: two profiles (Daddy–Daughter / Father–Son, both blank until the
  dad fills them in), 200 conversation starters across 10 categories,
  a daily suggestion + weekly challenge, and Say Back (paste what your
  kid said, get 3 warm, natural replies in 6 tones). No API keys exist to expose.
- Static site: `index.html` + `styles.css` + `app.js` + `icons/` +
  `manifest.webmanifest`. No build step.
- Add to Home Screen: the PWA manifest and `apple-touch-icon` are set so
  iOS shows **HoodTalk** with its own purple speech-bubble mark — no
  wrapper branding.

## Features (v1.6)

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
- **Dad Talk (new in v1.6):** a private space for dads, in its own
  bottom tab (third: Home, Modes, Dad Talk, History, Favorites,
  Settings). Two profiles — **Daddy–Daughter** and **Father–Son** —
  both start blank and are filled in only by the dad (name, age,
  interests, music, entertainment, games, activities, how they like to
  communicate, topics they enjoy, topics to avoid, goals). **Starters:**
  200 templates across 10 categories (Funny & random, Everyday
  check-ins, Music & entertainment, Hobbies & interests, Childhood
  memories, Dreams & future goals, Friendships & relationships, Life
  experiences, Confidence & encouragement, Meaningful father–child),
  personalized from profile data only — never stereotypes — with a
  seen-set so starters don't repeat until the pool is exhausted, and
  topics to avoid never appear. Copy / Regenerate / Save. **Daily:**
  a date-seeded suggestion and a week-seeded challenge on the hub.
  **Say Back:** paste what your kid said, pick one of 6 tones (Loving &
  supportive, Casual & natural, Funny & playful, Understanding &
  empathetic, Encouraging, Advice-oriented), get 3 genuinely different
  replies, plus a pattern-based needs hint (phrased as a suggestion,
  never a certainty) and the ask-permission line "Do you want my advice,
  or do you just need me to listen?" with Copy. **Privacy, on-device
  only:** nothing pasted is ever saved — the app processes it in memory
  and stores only generated text the dad explicitly saves; a "Clear all
  Dad Talk data" row in Settings wipes profiles, favorites, and history.
  Keys: `hoodtalk.dadtalk.profiles.v1`, `.favorites.v1`, `.history.v1`.
  Phases 4–6 (Reconnect, Activities, Practice, Coach) are v1.1, not v1.
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

- `index.html` — all six tabs (Home, Modes, Dad Talk, History,
  Favorites, Settings) + bottom tab bar. The Dad Talk panel holds four
  sub-views (Hub, Profiles, Starters, Say Back) switched in-page.
- `app.js` — the translation engine (lexicon, personalities, intensity
  scaling, translate-back, randomizer), history/favorites storage logic,
  and the browser UI. Pure functions are exported for node tests.
- `styles.css` — dark charcoal theme, neon purple + green.
- `icons/icon-180.png` (apple-touch-icon), `icon-192.png`, `icon-512.png`
  — drawn by `scripts/make_icons.py` (PIL).
- `tests/test.js` — node unit tests. `tests/` has no UI test; the jsdom
  UI smoke test lives in `/tmp/hoodtalk-smoke/smoke.js` (ephemeral) and
  is re-created when needed.

## Run locally

```sh
python3 -m http.server 8123
# open http://localhost:8123/
```

## Tests

```sh
node tests/test.js
```

116 unit tests, all passing. Covers: every personality × every input type
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
metadata completeness; **Dad Talk** (blank profiles; normalize/comma
lists; starter generation per category × 20 templates, all clean text
from a blank profile; personalization from filled profiles + neutral
fallback when blank; avoided topics never appear; seen-set non-repetition
and pool reset; daily/weekly determinism; Say Back 3 distinct labeled
replies per tone + tone distinctness; needs hint is a suggestion never
a certainty; no-retention — pasted text never hits storage; history
cap 50 / favorites cap 100 / no duplicate favorites; content
completeness — every template punctuated, slot names valid, every tone
bank ≥ 12 frames); static wiring (every `getElementById` target exists
in index.html; 6 tabs present).

UI smoke test (jsdom, ephemeral, re-created when needed):
`node /tmp/hoodtalk-smoke/smoke.js` — 29 checks, all passing. Covers boot
(chips, defaults, version 1.6.0), 6-tab bar order, Dad Talk hub (daily +
weekly render, privacy note), profile save to localStorage, starters
(10 category chips, regenerate changes text, save to Dad Talk favorites,
history recorded), Say Back (needs hint on typing, 6 tone chips, 3
result cards, ask-permission line, pasted text never in localStorage),
Settings clear-all-Dad-Talk-data, and regressions (translator 3 cards,
Fluent English fix, Say It Back 3 replies).

## Deploy

GitHub Pages from `main` (static site, no build step). Repo:
DevilInTheComments/hoodtalk → https://devilinthecomments.github.io/hoodtalk/

## Deliberately left for later

- **Dad Talk v1.1 (Phases 4–6 of the plan):** Reconnect (rebuilding
  after distance), Activities (things to do together), Practice
  (rehearse a conversation), and Coach (guided help through a hard talk).
- Full voice personalities (per-personality TTS voices beyond pitch/rate)
  — v1's Hear It button uses the browser's built-in speech synthesis.
- Sharing translations as images, daily phrase notifications, and any
  server-side features (accounts, sync) — all would break the $0/offline
  constraint and need a separate decision.
