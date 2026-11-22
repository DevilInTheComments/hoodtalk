# HoodTalk

A funny AI slang translator. Type literally anything and hear it back in
Hood Talk, Gangster, OG, Funny Hood, Crash-Out, Savage, Street Poet, or
Authentic — with an intensity slider from slight slang (1) to completely
unhinged (10).

- **$0, offline, no APIs, no accounts, no tracking.** Everything runs
  on-device in the browser. The "AI" is a rule-based transformation engine
  (lexicon swaps, personality openers/closers/fillers, intensity scaling)
  — no API keys exist to expose.
- Static site: `index.html` + `styles.css` + `app.js` + `icons/` +
  `manifest.webmanifest`. No build step.
- Add to Home Screen: the PWA manifest and `apple-touch-icon` are set so
  iOS shows **HoodTalk** with its own purple speech-bubble mark — no
  wrapper branding.

## Features (v1)

- **Translator (Home):** large text box, 8 personalities, intensity slider
  1–10, Translate button. Every translation returns **3 different
  variations**; each result has Copy, Regenerate, Save to favorites,
  Hear It (browser `speechSynthesis`, pitch/rate per personality), and
  Translate Back to normal English.
- **Modes:** personality browser — one-line description + example per
  personality, with a "Use" button that switches the translator to it.
- **History:** last 50 translations in localStorage; load back into the
  translator, copy, or delete.
- **Favorites:** saved results, with copy, hear-it, and remove.
- **Randomizer:** a 🎲 button that drops a random hood-talk phrase from a
  48-phrase bank covering all 8 personalities.
- **Settings:** default personality, default intensity, clear history,
  clear favorites, reset settings, about. Every button does something real.

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

Covers: every personality × every input type (statement, question, work
message, request, insult, long paragraph); variation distinctness;
intensity 1 vs 10 flavour difference (incl. Crash-Out all-caps at 10);
translate-back plainness (strips slang, keeps content words); the brief's
coffee example per personality; history/favorites pure logic; randomizer
variety; personality metadata completeness.

## Deploy

GitHub Pages from `main` (static site, no build step). Repo:
DevilInTheComments/hoodtalk → https://devilinthecomments.github.io/hoodtalk/

## Deliberately left for later

- Full voice personalities (per-personality TTS voices beyond pitch/rate)
  — v1's Hear It button uses the browser's built-in speech synthesis.
- Sharing translations as images, daily phrase notifications, and any
  server-side features (accounts, sync) — all would break the $0/offline
  constraint and need a separate decision.
