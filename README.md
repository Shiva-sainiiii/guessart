# GuessArt 🎨

**Draw. Guess. Roast your friend.**

A mobile-first, real-time Pictionary-style drawing & guessing game that
runs entirely peer-to-peer in the browser — no backend server, no
database, no accounts. Two players connect directly via WebRTC, take
turns drawing a secret word while the other guesses in chat, and talk
trash over always-on voice while they do it. There's also a fully
offline "Play vs Computer" mode for solo play with no friend required.

_Formerly known as Sketch Duel — renamed to GuessArt._

🔗 **Live:** [guessart.vercel.app](https://guessart.vercel.app)

---

## Table of Contents

- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [How the game works](#how-the-game-works)
- [The bot (Play vs Computer)](#the-bot-play-vs-computer)
- [Network protocol](#network-protocol)
- [Theming, i18n & UI](#theming-i18n--ui)
- [Running it locally](#running-it-locally)
- [Deploying](#deploying)
- [Adding a new drawable word](#adding-a-new-drawable-word)
- [Known limitations](#known-limitations)
- [Credits](#credits)

---

## What it does

- **Play with a Friend** — one player creates a room (gets a 6-character
  code / shareable link), the other joins. No sign-up, no server-side
  matchmaking — the room code *is* the host's WebRTC peer ID.
- **Play vs Computer** — a fully local, deterministic bot opponent that
  both draws (replaying hand-authored stroke sequences) and guesses
  (pattern/clue-based reasoning). Works instantly, no AI API required
  for gameplay itself.
- **Turns**: 8 rounds total (4 each), 70 seconds per round. One player
  draws a secret word on a shared canvas, the other tries to guess it
  in the chat box. Points are awarded for correct guesses with a speed
  bonus, and a smaller consolation score to the drawer.
- **Always-on voice chat** — the moment two real players connect, a
  live peer-to-peer audio channel opens automatically (Discord-style,
  no "start call" step), with independent mic/speaker mute toggles.
- **Progressive hints** — letter-blank tiles slowly reveal a few
  letters of the word as the timer runs down, plus rotating text clues
  that never contain the word itself.
- **Meme soundboard** — a radial FAB menu of voicelines (Nice!, Bruh,
  Wow, Laugh, Airhorn) both players hear at once.
- **Reconnect handling** — if a connection drops (network blip, tab
  backgrounded, accidental back button), both sides try to
  re-establish the link on the same room without restarting the game,
  and the host resyncs round/score/timer state once reconnected.
- **Hinglish-first UI** — a full `data-i18n` translation layer switches
  the entire UI (menus, screens, in-game labels, legal pages) between
  English and Hinglish, persisted across sessions.
- **Light/Dark themes** — a distinct glassmorphism dark-navy theme and
  a warm cream light theme, togglable from Settings and persisted.
- **Zero backend for gameplay** — the only server-side code in this
  repo is one optional serverless function for AI-flavored bot chat
  banter (see below); everything else — drawing, guessing, voice,
  scoring, reconnect — is peer-to-peer or fully client-side.

## Tech stack

| Layer | Choice |
|---|---|
| UI | Vanilla HTML/CSS/JS — **no framework, no build step** |
| Peer connection | [PeerJS](https://peerjs.com/) (`peerjs@1.5.4`, loaded via CDN) on top of WebRTC |
| NAT traversal | Google public STUN + [Open Relay Project](https://www.metered.ca/tools/openrelay/) public TURN (free, no signup) |
| Canvas | Native `<canvas>` 2D API, normalized (0–1) coordinates so drawings map correctly across different screen sizes |
| Voice | WebRTC media stream via PeerJS's `call()` API — no separate signaling needed |
| Bot brain | 100% local/deterministic — a hand-authored stroke library (`js/drawings.js`) + pattern/clue-matching guess logic (no AI call for actual gameplay) |
| Optional AI | [OpenRouter](https://openrouter.ai/) free-tier model, called only from one serverless function, only for bot small-talk (never for guessing/drawing) |
| Hosting | Static site + one serverless function — deploys cleanly to [Vercel](https://vercel.com) with zero config |
| Persistence | `localStorage` only (theme, language preference) — no database anywhere |

No `npm install` is needed to run this app — `package.json` exists
only to pin the Node engine (`>=18`) for the one serverless function.
Everything under the site root is served as-is.

## Architecture

```
┌──────────────┐        WebRTC DataChannel        ┌──────────────┐
│   Player A    │ ◄──────────────────────────────► │   Player B    │
│  (Host/Room)  │        + WebRTC Audio (voice)     │   (Guest)     │
└──────┬───────┘                                    └──────┬───────┘
       │  PeerJS signaling (public PeerJS cloud broker,     │
       │  used only to establish the connection —           │
       │  no game data ever passes through it)               │
       └──────────────────────┬───────────────────────────┘
                               │
                    ┌──────────────────────┐
                    │  Vercel (static host)  │
                    │  api/bot-chat.js        │  ← optional, bot banter only
                    │  (→ OpenRouter, if key   │
                    │     is configured)       │
                    └──────────────────────┘
```

There is **no game server**. `js/connection.js` opens a direct
WebRTC connection between the two browsers using PeerJS purely for
initial signaling (finding each other) — every stroke, chat message,
guess, and score update after that travels client-to-client over the
data channel, never through any backend.

**"Play vs Computer" reuses the exact same protocol.** `js/bot.js`'s
`BotPeer` object impersonates `Connection`'s public interface
(`send`/`onMessage`/`onOpen`/`isConnected`/`destroy`, etc.), so
`app.js` and every other module talk to the bot exactly the same way
they'd talk to a real WebRTC peer. This means there's no
`if (isBotGame)` branching scattered through the game logic — the bot
is just a different implementation sitting behind the same interface.

## Project structure

```
guessart/
├── index.html               # All screens/markup: home, waiting room, game,
│                             # round result, game over, menu + settings
│                             # sub-panels, legal panels, inline SVG icon sprite
├── app.js                    # Wires up UI ↔ Connection ↔ Canvas ↔ Game.
│                             # Owns screen routing, the i18n engine, theme
│                             # persistence, chat rendering, network message
│                             # dispatch (see the protocol table at the top
│                             # of this file), reconnect UI states
├── style.css                  # All styling: CSS custom properties for
│                             # theming, 100dvh/flexbox mobile-first layout,
│                             # glassmorphism dark theme + light theme overrides
├── js/
│   ├── connection.js          # PeerJS/WebRTC connection layer: host/guest
│   │                          # roles, ICE server config, reconnect-with-backoff
│   ├── canvas.js               # Drawing engine: stroke capture, flood fill
│   │                          # (color-distance tolerance), undo, remote
│   │                          # stroke/fill rendering, resize-safe redraw
│   ├── game.js                 # Turn management, round timer, scoring, win logic
│   ├── hints.js                 # Progressive letter-reveal schedule (drawer-
│   │                          # authoritative, sent to guesser piece by piece)
│   ├── clues.js                  # Rotating text-clue cycling for the guesser
│   ├── words.js                  # The word list — 150+ entries, each with
│   │                          # 2–3 hand-written non-giveaway clues
│   ├── drawings.js               # Hand-authored stroke-by-stroke drawing
│   │                          # library for the bot (140+ words), captured
│   │                          # via a standalone tester tool (see below)
│   ├── bot.js                    # BotBrain (drawing/guessing intelligence),
│   │                          # BotChat (conversational banter routing),
│   │                          # BotPeer (network-shaped stand-in for Connection)
│   ├── audio.js                   # Sound effects + voiceline playback,
│   │                          # autoplay-policy-safe unlock handling
│   └── voicecall.js                # Always-on P2P voice: independent mic/
│                              # speaker toggles, mic-permission-safe
├── api/
│   └── bot-chat.js                # Vercel serverless function: optional
│                              # OpenRouter-backed bot small talk. Stubs
│                              # cleanly to local canned replies until
│                              # OPENROUTER_API_KEY is set — no code change
│                              # needed later, it just starts working.
├── public/
│   ├── audio/                     # sfx + voiceline .mp3 files
│   └── images/                    # logo, favicon, OG cover, donate QR
├── package.json                    # Just pins Node >=18 for the serverless fn
├── robots.txt / sitemap.xml         # Basic SEO
└── googledecff8a97b3b7f45.html      # Google Search Console verification file
```

## How the game works

1. **Home screen** — pick "Play with Friend" (Create Room / Join Room)
   or "Play vs Computer".
2. **Room setup** — the host's PeerJS ID becomes the room code. The
   guest connects directly to that ID.
3. **Turn loop** (`js/game.js`, `TOTAL_ROUNDS = 8`, `ROUND_SECONDS = 70`):
   - Whoever's turn it is gets a word (from `js/words.js`) and draws
     it on the shared canvas (`js/canvas.js` streams strokes over the
     data channel in near-real-time).
   - The other player sees the word's letter/space pattern
     (e.g. `LLL LLLLL`) with letters progressively revealed as the
     timer counts down (`js/hints.js`), plus rotating text clues
     (`js/clues.js`), and types guesses into chat.
   - A correct guess ends the round early; the drawer confirms it, the
     word is revealed to both, and points are split (bigger reward for
     a fast correct guess, a smaller flat reward for the drawer).
   - No correct guess before the timer hits 0 → round ends, word is
     revealed, no points awarded.
4. **Round result screen** → **next round**, alternating who draws,
   until all 8 rounds are done.
5. **Game over screen** shows the final score with **Play Again**
   (restarts in the same room/bot session via a small handshake — no
   reconnect needed) or **Back to Home**.

Coordinates for every stroke are normalized to a 0–1 range before
being sent, so a drawing looks correct regardless of each player's
screen size or orientation.

## The bot ("Play vs Computer")

The bot is intentionally **not** an LLM wrapper for actual gameplay —
drawing and guessing need to be instant and reliable, so both are
100% local and deterministic:

- **Drawing**: `js/drawings.js` is a hand-authored library of
  140+ words, each stored as a literal sequence of canvas actions
  (`gesture` = a stroke's point path, `fill` = a flood-fill at a
  point) captured with a standalone browser tool (a "tester" utility,
  not included in this repo) and pasted in as plain arrays. `BotBrain`
  replays these stroke-by-stroke at a human-plausible pace. Words
  without a hand-authored entry fall back to a smaller generic
  template set, then finally a basic category sketch.
- **Guessing**: `BotBrain.chooseGuess` works off the same information
  a real player would have — the revealed letter pattern and the
  clues sent so far — narrowing a candidate word list and occasionally
  throwing in a plausible wrong guess before the real one, so it
  doesn't feel telepathic.
- **Chat personality**: separately, `BotChat` classifies any incoming
  message as either a real guess attempt (handled above, untouched) or
  just conversation ("bhai hara diya na", trash talk, banter). Only
  conversational messages get a reply. Replies come from a local
  canned Hinglish pool by default, or — if `OPENROUTER_API_KEY` is set
  in the deployment's environment — from `api/bot-chat.js`, a tiny
  serverless function that calls an OpenRouter model with a short
  system prompt (stays in character, never reveals the secret word,
  keeps replies to one short line). If that call fails, times out, or
  no key is configured, it degrades silently back to the local pool —
  the chat feature can never break, worst case it's just less witty.

## Network protocol

All messages are small JSON objects sent through `Connection.send()`
(or the bot's `BotPeer.send()` shim). Full reference lives as a
comment block at the top of `app.js`; summary:

| Message type | Purpose |
|---|---|
| `hello` / `rename` | Exchange/update player names |
| `start_turn` | Host tells guest whose turn it is |
| `word_length` | Letter/space pattern for hint tiles (never the word itself) |
| `hint_reveal` | One more letter unlocked |
| `clue` | Rotating text hint |
| `stroke` / `fill` / `clear` / `undo` | Canvas sync |
| `chat` | Chat/guess message |
| `correct_guess` / `timeout` | Round resolution |
| `next_turn` | Advance to the next round |
| `sync_state` | Host → guest catch-up payload sent right after a reconnect |
| `voiceline` | Trigger a shared meme sound (played locally on both ends) |

Voice itself isn't part of this JSON protocol — it's a separate,
always-on WebRTC media call opened directly via PeerJS's `call()` API.

## Theming, i18n & UI

- **Themes**: CSS custom properties in `:root` define the dark
  glassmorphism theme; `body[data-theme="light"]` overrides swap in a
  warm cream palette. Toggled from Settings, persisted to
  `localStorage`.
- **i18n**: a generic engine in `app.js` — any element tagged
  `data-i18n="key"` (plain text), `data-i18n-html="key"` (for strings
  needing inline markup like `<strong>`), or
  `data-i18n-placeholder="key"` gets swapped automatically against a
  dictionary (`LANG_STRINGS.en` / `LANG_STRINGS.hi`). Adding a new
  translated string anywhere is just adding the attribute + one
  dictionary entry — no manual `querySelector` wiring needed. Covers
  the home screen, waiting room, hamburger menu + all its sub-panels,
  in-game static labels, and legal pages. Dynamically generated
  runtime strings (chat messages, hint reveals, bot dialogue) are
  translated at the point they're generated instead.
- **Icons**: a single inline SVG `<symbol>` sprite sheet at the top of
  `index.html`, referenced everywhere via `<use href="#icon-name">` —
  no icon font, no external icon requests, and icons automatically
  pick up `currentColor` so they match each button's state.
- **Mobile-first layout**: `100dvh` + flexbox throughout (no JS-measured
  viewport heights), so the on-screen keyboard, safe-area insets, and
  orientation changes are all handled natively by the browser instead
  of being manually tracked and re-synced in JavaScript.

## Running it locally

Since there's no build step, you have two options:

**Option A — plain static server (gameplay only, no bot AI chat):**
```bash
npx serve .
# or
python3 -m http.server 8000
```
Open the printed URL. Everything works except `api/bot-chat.js` (which
needs Vercel's serverless runtime) — the bot chat feature just falls
back to local canned replies, which is the default state anyway.

**Option B — full local stack including the serverless function:**
```bash
npm i -g vercel
vercel dev
```
This serves the static files *and* runs `api/bot-chat.js` locally the
same way it runs in production.

No `.env` file is required to play. To enable AI-flavored bot chat
locally, create a `.env.local` with:
```
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=nvidia/nemotron-3-super-120b-a12b:free   # optional override
```

## Deploying

Deploys to [Vercel](https://vercel.com) with zero configuration —
just connect the GitHub repo. Vercel auto-detects the static site plus
the one function under `api/`.

To turn on AI bot banter in production: **Vercel dashboard → Project →
Settings → Environment Variables → add `OPENROUTER_API_KEY`** (get a
free key at [openrouter.ai](https://openrouter.ai)) → redeploy. No
frontend code changes needed — `api/bot-chat.js` picks it up
automatically and stops returning stub replies.

## Adding a new drawable word

1. Add an entry to `WORD_LIST` in `js/words.js`:
   ```js
   { word: "example", clues: ["Clue one.", "Clue two.", "Clue three."] }
   ```
   Clues should never contain the word itself.
2. *(Optional but recommended)* give the bot a real hand-drawn sketch
   for it instead of falling back to a generic shape — capture one
   with the standalone tester tool and paste the resulting step array
   into `js/drawings.js` as a new `word: [ ...steps ]` entry. Make sure
   any `fill` action sits inside a genuinely closed outline (the flood
   fill uses color-distance matching, not just exact pixels, but it
   still needs a real closed boundary — an open gap will leak across
   the whole canvas).

## Known limitations

- WebRTC connections behind very restrictive symmetric NATs or locked-
  down corporate/campus firewalls can still occasionally fail even
  with the TURN relay configured — there's no fallback beyond
  STUN/TURN.
- PeerJS's public cloud broker (used only for initial signaling) is a
  free shared service — if it has an outage, new connections can't be
  established, though already-connected games aren't affected.
- The bot's hand-authored drawing library covers 140+ words; words
  outside that set get a generic category sketch rather than a
  purpose-drawn one.
- No accounts, no persistent stats/leaderboards, no matchmaking beyond
  direct room codes — by design, to keep this a zero-backend project.

## Credits

Built solo by **Shiva Saini** ([@shiva-sainiiii](https://github.com/shiva-sainiiii)) —
entirely vanilla JS, no frameworks. Voice chat and P2P networking via
[PeerJS](https://peerjs.com/); free TURN relay via
[Open Relay Project](https://www.metered.ca/tools/openrelay/); optional
bot banter via [OpenRouter](https://openrouter.ai/).

If you enjoy the game, the donate/UPI link in the in-app menu (Gift &
Donate) is the best way to support future work on it.
