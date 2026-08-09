# GuessArt

Mobile-first real-time drawing/guessing game for long-distance friends.
Peer-to-peer via WebRTC (PeerJS) — no backend, no database.

_Formerly known as Sketch Duel — renamed to GuessArt._

## Phase 2.3: Rotating text clues + polished home screen + meme voicelines

- **Rotating text clues**: every word in `js/words.js` now carries 2-3
  hand-written hint sentences (never containing the word itself). The
  drawer's client cycles through them every ~12 seconds and sends each
  one to the guesser, who sees them fade in under the hint tiles.
- **Home screen redesign**: the static red "Enter your name to
  continue" warning is gone — tapping Create/Join with an empty name
  now gives the field a quick shake instead. The name field also has
  an animated typewriter placeholder ("Enter Nickname" → "e.g. Rahul"
  → ...) that stops the instant you focus or type.
- **Meme voiceline FAB**: a 🎤 button on the game screen opens a radial
  pie menu with 5 voiceline buttons. Tapping one plays it on BOTH
  players' screens (it's a shared reaction, not just for you).
- **Sound effect hooks**: round-countdown tick (last 3 seconds),
  turn-start chime, correct-guess ding, and win/lose jingles are all
  wired to the right game moments. No audio files are bundled — see
  `public/audio/README.md` for the exact filenames to drop in.

## Phase 2.2: Easier guessing + easier drawing (hint system + undo/eraser)

- **Progressive hint reveal**: the guesser sees blank tiles for the
  word (`_ _ _ _ _`, with proper gaps for multi-word answers like
  "ice cream"). The first and last letter of each word unlock
  instantly, then one more random letter unlocks at 75%, 55%, 35%,
  and 18% of the round timer — capped at ~45% of the word so it
  never fully gives itself away.
  - Security note: the guesser's client never receives the actual
    word — only the letter/space pattern up front, then individual
    `{index, letter}` reveals sent by the drawer's client as they
    unlock. There's no way to inspect the page and read the word early.
- **Eraser tool**: real canvas erasing (not just white paint) via
  `destination-out` compositing, toggle on/off in the toolbar.
- **Undo button**: removes the drawer's last full pen-stroke (not
  just the last tiny segment) and stays in sync with the guesser's
  screen.

## Phase 2 (current): Full Game Loop

What works now:
- Room create/join (6-char code) — from Phase 1
- Turn-based drawing: one player draws, the other watches live and guesses
- Real-time stroke sync over WebRTC (drawing appears on both screens as it happens)
- Secret word assigned from a fixed list (only the drawer sees it)
- Open chat — both players can chat/guess, all messages visible to both
- Automatic correct-guess detection (case-insensitive, trimmed match)
- Scoring: guesser gets points (with a speed bonus), drawer gets points too
- 70-second timer per turn, 8 total turns (4 each), alternating
- Round-result screen between turns, final game-over screen with winner
- Color picker, brush size, eraser, undo, clear canvas (drawer only)
- Instagram-style chat: message bubbles, timestamps, sent/seen ticks, emoji picker
- Canvas gets a fixed portion of the screen so the on-screen keyboard
  opening (typing a guess) never resizes or clears the drawing

## How to test locally

No build step needed — it's plain HTML/CSS/JS.

```bash
cd sketch-duel
python3 -m http.server 8080
```

Open `http://localhost:8080` in two different browser tabs (or two devices
on the same wifi, using your computer's local IP instead of localhost) to
simulate two players.

1. Tab/Device A: enter a name → tap "Create Room" → note the 6-char code
2. Tab/Device B: enter a name → enter that code → tap "Join Room"
3. Once connected, the game starts automatically — host draws first
4. Drawer: pick a color/size and draw; word is shown only to them
5. Guesser: type guesses in the chat box — correct guess is auto-detected
6. Turns alternate automatically until all 8 rounds are done

## Phase 2.1: Home screen flow + sharing

- Name is required before either Create Room or Join Room becomes tappable
- Join Room button visually lights up (turns purple) the moment a valid
  room code is typed, instead of being static
- "Share Link" button on the waiting screen opens the native share sheet
  (WhatsApp, Messages, etc.) with a direct join link — opening that link
  auto-fills the room code on the other end

```
sketch-duel/
├── index.html          — all screens (home, waiting, game, results)
├── style.css            — mobile-first dark theme
├── app.js                — wires UI + connection + canvas + game together,
│                           defines the network message protocol
├── js/
│   ├── connection.js     — WebRTC/PeerJS connection layer
│   ├── canvas.js          — drawing engine, stroke history/undo, eraser, normalized-coordinate stroke sync
│   ├── game.js             — turn management, timer, scoring, word logic
│   ├── hints.js             — progressive hint reveal (drawer-authoritative, letters sent one at a time)
│   ├── clues.js             — rotating text hints (drawer-authoritative, cycles every ~12s)
│   ├── audio.js             — sound effects manager (voicelines + SFX, all placeholder file paths)
│   └── words.js            — fixed word list + 2-3 clue sentences per word
└── public/
    ├── audio/              — drop your own .mp3s here — see audio/README.md for exact filenames
    ├── images/
    └── data/
```

## Deploying to Vercel

This is a fully static site — no environment variables, no server needed
for Step 1.

```bash
vercel deploy
```

or just connect the GitHub repo to Vercel and it'll deploy on every push.

## Known limitation to watch for

PeerJS's default connection uses STUN only (no TURN server). This works
for most home wifi / mobile data connections, but can fail on strict
corporate/campus networks or certain carrier NATs. If real-world testing
shows connection failures, the fix is adding a free TURN server (e.g.
Open Relay Project) to the PeerJS config in `app.js`.

## Next steps (not built yet)

- Phase 2: Canvas drawing + real-time stroke sync over the data channel
- Phase 3: Game loop — word prompts, timer, reveal, scoring, round modifiers
- Phase 4: In-game chat + emoji reactions
- Phase 5: Meme voiceline triggers on game events
- Phase 6: Voice chat (WebRTC media stream, reusing the same peer connection)
