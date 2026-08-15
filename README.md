# GuessArt

Mobile-first real-time drawing/guessing game for long-distance friends.
Peer-to-peer via WebRTC (PeerJS) — no backend, no database.

_Formerly known as Sketch Duel — renamed to GuessArt._

## Phase 2.11: Fixed fill leaking across the whole canvas + drawing accuracy pass

- **"Fill leaks and paints the entire canvas"**: root-caused to two
  compounding issues. (1) `floodFillRaw()` in `js/canvas.js` matched
  pixels by EXACT color equality — but canvas strokes are anti-aliased,
  so the pixels right along any outline are a blend, not a pure exact
  match to either the background or the ink. That made the fill treat
  the anti-aliased ring around a thin or slightly-open line as "still
  open", walking straight through it and spilling across the whole
  canvas. Rewrote it to use color-DISTANCE tolerance matching (the same
  approach every real paint-bucket tool uses), so near-background
  anti-aliased pixels correctly read as fillable right up to the actual
  ink. (2) Separately and more fundamentally, `js/drawings.js`'s
  hand-authored entries had ~50 fill actions sitting on outlines that
  weren't actually closed (the stroke's start and end points didn't
  touch) — some gaps as large as 80-90% of the canvas — which no amount
  of pixel tolerance can contain, since there's no wall there at all no
  matter how it's matched. Audited and closed every one of these across
  all 130 words (see below), AND added a runtime safety net in
  `js/bot.js`: `drawingStepsToBeats()` now checks the outline
  immediately before any fill and auto-inserts a same-color closing
  segment if it isn't already closed, so even a future hand-drawn entry
  that's imperfectly closed can't leak.
- **Drawing accuracy pass across all 130 `js/drawings.js` entries**:
  every gesture that's followed by a fill now forms a genuinely closed
  polygon, and every fill's x,y was recomputed to the shape's true
  geometric centroid (rather than a hand-placed point that could drift
  outside on a redraw) — this alone fixed dozens of fills that were
  technically "inside enough" before but landed suspiciously close to
  an edge. Ten of the most broken entries (burger, peacock, chili,
  popcorn, waterfall, desert, lightning, canyon, climbing, robot) had
  fills sitting on completely open lines with no enclosed area at all —
  these were fully redrawn as proper closed shapes rather than patched.
  20 fill actions that had literally no possible enclosed area (a fill
  called on a bare 2-point line — glasses, cactus, meadow, and the
  action-word figures like dancing/swimming/flying/etc.) were removed
  outright rather than papered over, since there was nothing there for
  them to usefully color anyway.

## Phase 2.10: Three critical bot/canvas bugs fixed

- **Bot drawing was painfully slow, sometimes timing out**: `BotPeer`'s
  `emit()` was tacking a 250-650ms randomized "network latency" delay
  onto EVERY message — including every individual stroke segment of a
  drawing. That delay stacked on top of the drawing's own pacing
  (already spread across ~45s), so a detailed sketch could take 2-3x
  longer than intended to finish, sometimes eating past the 70-second
  round timer before it was even done. Fixed: stroke/fill messages now
  get a small 15-40ms jitter instead; only one-off messages (chat,
  hello, clues) keep the human-like delay.
- **Bot went completely silent as guesser from round 2 onward**: when a
  round ended, `showRoundResult()` was calling `advanceTurn()` (which
  immediately fires off `word_length`/`hint_reveal`/`clue` messages for
  whoever draws next) BEFORE sending the `next_turn` message that tells
  `BotPeer` whose turn it actually is now. So every round after the
  first, the bot received the new word's pattern/hints/clues while its
  internal `botIsDrawer` flag still held the PREVIOUS round's value —
  the guard checks silently dropped all of it, leaving the bot with no
  information to guess from. Fixed by sending `next_turn` first, and
  additionally hardened `BotPeer` to fully reset its guesser state on
  every turn transition so no stale pattern/tried-guesses data can leak
  into a new round even if a future change reintroduces a similar
  ordering issue.
- **Canvas going blank mid-round (both bot AND real-friend games)**:
  `DrawCanvas.renderRemoteStroke()`/`renderRemoteFill()` — the functions
  that paint a stroke arriving from the OTHER player — were only
  painting directly onto the canvas, never recording it into
  `strokeHistory`. Any time the canvas resized (a hint tile row
  appearing, keyboard open/close, orientation changes — anything that
  changes the draw area's layout), `resizeCanvas()` clears the canvas
  and repaints strictly from `strokeHistory` — which, for the person
  guessing, was always empty. Every resize wiped their screen back to
  blank, discarding everything the other player had drawn so far. Now
  every remote stroke/fill is recorded (consecutive same-gesture
  segments are merged into one history entry, mirroring how the local
  drawer's own pointer-drag becomes one entry, so `MAX_HISTORY` — raised
  from 60 to 150 — isn't blown through by a single detailed sketch).

## Phase 2.9: Play Again, separated Create/Join, and Play with Computer

- **Play Again (rematch)**: the game-over screen previously only had a
  "Back to Home" button disguised with the old label, which tore down
  the WebRTC connection and reloaded the page every single time a game
  finished — losing the room and disconnecting from your friend even
  if you both wanted to play again. Now there are two real buttons:
  **Play Again** restarts the same session in place (same room / same
  bot, scores reset, turn order flips) via a small `rematch_request` /
  `rematch_accept` handshake so both clients restart in lockstep, and
  **Back to Home** keeps the old full-reset behavior for when you
  actually want to leave.
- **Create Room and Join Room are separate now**: the home screen used
  to stack both actions in one card with a plain "or" divider between
  them. They're now two distinct sub-tabs under a "Play with Friend"
  mode — picking one fully hides the other, so there's no ambiguity
  about which button does what.
- **Play with Computer**: a brand new top-level mode next to "Play
  with Friend". No room code, no second device — starts instantly
  against an offline, rule-based bot (`js/bot.js`) that plays BOTH
  roles depending on whose turn it is:
  - **As drawer**, it picks a word and paints a recognizable sketch
    using a small library of hand-built shape templates for common
    words, falling back to category-based generic sketches (animal,
    food, "person doing an action", landscape, small object) for every
    other word in `js/words.js`, so no word ever draws a blank canvas.
  - **As guesser**, it reads the same word-length pattern, revealed
    letters, and rotating clue text a human guesser would see, and
    scores every remaining candidate word by pattern-fit + clue
    keyword overlap to send a guess — with human-like randomized
    timing so it doesn't feel like a reflex.
  - Architecturally, `BotPeer` implements the exact same interface as
    the real `Connection` module (`send`/`onMessage`/`onOpen`/...), so
    every existing piece of turn/chat/hint/clue protocol handling in
    `app.js` runs completely unchanged — it has no idea whether it's
    talking to a friend over WebRTC or a local bot.
  - No API key, no network calls — fully offline. A real AI-backed
    brain (OpenRouter or similar) is a natural next step: it would only
    need to replace `BotBrain.chooseGuess()` / `BotBrain.planDrawing()`
    internals, the `BotPeer` wiring around it stays the same.

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

## Phase 2.4: UI redesign — voice, topbar, settings, fill tool

- **Voice is now always-on, no "Start Call" step.** The moment both
  players connect, the app quietly asks for mic permission and opens a
  background audio channel — no ringing, no accept/decline screen. If
  the mic permission is denied, voice just silently stays unavailable
  and the rest of the game still works.
- **Mic and Speaker are two independent icon toggles** (🎤 / 🔊) in a
  slim strip under the topbar — no more single confusing "mute" button.
  - Mic off → your audio isn't sent, you still hear your friend
  - Speaker off → you don't hear your friend, they still hear you
  - Both live in the topbar AND inside Settings, kept in sync
- **Topbar redesigned**: each player now gets a clearly bounded name
  chip (you on the left, friend on the right) instead of a cramped
  right-aligned "Name: score" string. Round/timer sit centered between
  them, with a ⚙️ settings gear on the far right.
- **New Settings panel** (gear icon): mic/speaker toggles, sound effects
  toggle, meme voicelines toggle, rename yourself mid-game (announced
  to your friend in chat), and a Leave Game button.
- **Fill (bucket) tool** added to the drawing toolbar — tap it, tap a
  color, then tap an enclosed region on the canvas to flood-fill it.
  Fills are undo-able and sync to the other player like strokes do.
- **Color scheme changed** from purple/pink to a teal/coral palette —
  meant to feel more like a creative sketch tool and less like a
  generic app template.
- **Developer credit line restyled** — was oddly left-shifted and
  wrapping awkwardly; now a small, centered, understated byline under
  the logo instead of competing with the title for attention.

## Voice implementation notes

Voice reuses the same PeerJS `peer` object the data channel already has
open — no second signaling connection. Whoever is the **host** places
the outgoing `peer.call()`; the guest only listens for the incoming
call event. This avoids both sides dialing each other simultaneously.

## Phase 2.5: Icon system, favicon, and bug fixes

### Visual
- Replaced every UI-chrome emoji (mic, speaker, settings, fill, eraser,
  undo, trash, send, close, smile, trophy) with a shared inline SVG icon
  sprite sheet (`<symbol>` defs at the top of `index.html`, referenced
  via `<use href="#icon-name">`). Icons pick up `currentColor`, so they
  automatically match each button's active/inactive state.
- Chat emoji picker and casual reactions were kept as real emoji on
  purpose — those are meant to feel expressive/informal, unlike button
  chrome which needed to look consistent and crisp at small sizes.
- Added a favicon + apple-touch-icon (generated from the provided logo,
  32×32 and 180×180) and a small logo image above the "GuessArt" title
  on the home screen.
- Brush-width buttons (previously ●⬤⚫ text glyphs) are now small solid
  circles drawn in CSS, sized consistently regardless of device font.

### Bugs fixed
- **Fill/Eraser buttons appeared to do nothing.** Root cause: their
  click handlers used `e.target` to toggle the `.active` class. Once
  the buttons got SVG icons inside them, `e.target` became the inner
  `<span>`/`<svg>` rather than the `<button>` itself, so the highlight
  (and in some code paths, the mode) silently applied to the wrong
  element. Fixed by using `e.currentTarget` everywhere in the toolbar.
- **Flood fill could silently no-op** if it ran in the same frame as a
  canvas resize (dimension mismatch between the CSS box and the canvas's
  actual backing buffer). `floodFillRaw()` now checks the backing size
  matches before reading/writing pixels, and the whole function is
  wrapped in a try/catch so a transient failure never breaks the draw
  loop.
- **Voicelines played on the triggering side but not the other.** This
  is a browser autoplay-policy quirk: a `.play()` call is only reliably
  allowed on an audio element that's been "unlocked" by a direct user
  gesture. The player who taps a voiceline unlocks it themselves; the
  OTHER player receives the trigger over the data channel (not a user
  gesture) and their browser could silently block it. Fixed by calling
  `AudioFX.unlockAudioContext()` on the very first tap/touch anywhere in
  the app, which primes every cached sound file before any remote
  trigger can arrive.
- **Canvas appeared to scroll off-screen when the keyboard opened.**
  `body` had `display:flex` centering but no `position:fixed`, so when
  the mobile keyboard tried to scroll a focused input into view, it
  scrolled the whole page (canvas included) rather than just the chat
  panel. `html, body` are now pinned with `position:fixed; overflow:hidden`,
  so only content inside `.screen-game` (whose height is separately
  locked via `--app-vh`) can respond to the keyboard at all.

## Phase 2.6: Real fix for the keyboard/canvas bug, icon contrast, panel ratios

### The actual root cause of the keyboard bug
Every previous attempt patched symptoms (locking body scroll, locking
`.screen-game`'s height from JS) but the real fix was one line in the
viewport meta tag: `interactive-widget=overlays-content`. Without it,
mobile browsers treat the on-screen keyboard as something that RESIZES
the page's layout viewport — which is what kept dragging the header and
canvas upward no matter how many heights we pinned in CSS, since
`window.innerHeight` itself was shrinking. With `overlays-content` set,
the keyboard now floats ON TOP of the page instead, and the layout
viewport (and therefore every height derived from it) never changes
when the keyboard opens or closes.

With that in place:
- `#app-viewport` stays completely still — header and canvas never move.
- Only `.game-panel-bottom` (the chat section) reacts to the keyboard,
  via a new `--keyboard-inset` CSS variable kept live by
  `trackKeyboardOffset()` in app.js (reads `visualViewport`, which still
  correctly reports keyboard height even though layout doesn't shrink).
  That padding eats into the chat panel's own existing height budget —
  the message log shrinks, the input row rises to sit just above the
  keyboard, and neither the header nor the canvas panel are touched at
  all, exactly as requested.
- The voiceline FAB also rises with `--keyboard-inset` so it stays
  pinned just above the input row instead of getting buried.

### Panel ratios
Rebalanced to give the canvas more room: header 15% / canvas 52% / chat
33% (previously closer to an even 20/40/40 split). Topbar, voice strip,
word banner, and hint tiles were all tightened up (smaller icons, less
padding) so they still fit comfortably in the shorter header.

### Icon contrast
Found several icon buttons (topbar settings gear, voice strip mic/
speaker) that never set an explicit `color`, so they fell back to the
browser's default button text color instead of the app's `--text`
variable — invisible against a dark background. All icon buttons now
explicitly set `color`. Toolbar button borders were also bumped to a
translucent white so the buttons themselves are visible against the
similarly-dark card background, not just the icons inside them.

### Fullscreen
`requestAppFullscreen()` (hides the browser's URL bar on supporting
mobile browsers) was already wired to fire from the Create/Join button
taps — this satisfies the browser's user-gesture requirement for the
Fullscreen API. iOS Safari doesn't implement the Fullscreen API at all,
so this has no visible effect there (a platform limitation, not a bug) —
Android Chrome and most other mobile browsers do support it.

## Phase 2.7: Critical bug fix — home screen and game screen both visible at once

Found the real cause of "everything renders on top of each other" —
`.screen-game { display: flex; ... }` was setting `display` completely
unconditionally, with no `.active` requirement. Since `#screen-game`
carries both the `.screen` class (which says `display: none` by
default) and the `.screen-game` class (single-class selector, same
specificity, declared later in the file), `.screen-game` always won the
cascade — meaning the game screen was NEVER actually hidden, even
before a room was created or joined. It sat there the whole time,
stacked underneath whichever screen currently had `.active`, and became
visible the moment its own content had anything to show, independent of
`showScreen()`.

Fixed by moving `display: flex` into `.screen-game.active` specifically,
matching every other screen's pattern. Also added a defense-in-depth
rule — `.screen:not(.active) { display: none !important; }` — so any
future rule that accidentally sets `display` on a screen without gating
it behind `.active` gets overridden rather than silently causing the
same class of bug again.

## Phase 2.8: Header hides on keyboard open, chat rises above it

- **Header now fully hides (not shrinks) when the keyboard opens.**
  `.game-panel-top` collapses to `flex: 0 0 0%` with a fade-out, handing
  its entire share of the screen to the canvas panel (`flex: 1 1 auto`).
  Reverts instantly the moment the keyboard closes (`.keyboard-open`
  class comes off `<body>`, driven by `--keyboard-inset` from
  `trackKeyboardOffset()` in app.js).
- **Canvas takes the freed space** and stays fully visible the whole time.
- **Chat panel switches to a fixed 168px height** while the keyboard is
  open (rather than its normal 34% share) — enough room for the input
  row plus the last message or two, so you can see recent context and
  what you're typing without it being just a bare input strip.
- **The whole game screen gets keyboard-aware bottom padding**
  (`padding-bottom: calc(8px + var(--keyboard-inset))` on `.screen-game`)
  so the chat panel's bottom edge — and therefore the input row — ends
  just above the keyboard instead of sliding underneath it, since the
  keyboard overlays the page rather than resizing it.
