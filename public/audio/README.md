# Audio files — drop your own .mp3s here with these EXACT names

The app looks for these files by name inside `public/audio/`. Nothing is
included by default — the game runs fine without them (missing files
fail silently, no errors), but sounds obviously won't play until you
add them. Any `.mp3` works; keep files small (under ~200KB each) so
they load instantly on mobile data.

## 🎤 Meme voicelines (the FAB button menu — 5 slots)

| Filename                  | Suggested vibe                                  | Length     |
|----------------------------|--------------------------------------------------|------------|
| `voiceline-nice.mp3`       | A short "niiice!" / approving reaction clip      | 0.5–1.5s   |
| `voiceline-bruh.mp3`       | Classic "bruh" sound effect                      | 0.5–1s     |
| `voiceline-wow.mp3`        | Exaggerated "wow!" / surprised reaction          | 0.5–1.5s   |
| `voiceline-laugh.mp3`      | A meme laugh track / cartoonish laugh            | 1–2s       |
| `voiceline-airhorn.mp3`    | The classic DJ airhorn hype sound                | 1–2s       |

These play the instant either player taps them in the radial menu —
BOTH players hear it (it's a shared reaction button), so keep them
punchy and not annoying on repeat.

## 🔊 System sound effects

| Filename                     | When it plays                                        | Suggested vibe                        | Length   |
|-------------------------------|--------------------------------------------------------|------------------------------------------|----------|
| `sfx-round-countdown.mp3`     | Every second during the last 3 seconds of the timer     | A soft tick/beep, not jarring            | 0.2–0.5s |
| `sfx-turn-start.mp3`          | The instant a new turn begins (both players)            | A light chime/whoosh                     | 0.5–1s   |
| `sfx-correct-guess.mp3`       | The moment a guess is confirmed correct                 | A satisfying "ding" / success jingle     | 0.5–1.5s |
| `sfx-win.mp3`                 | Game-over screen, only for the player who won            | Triumphant/victory jingle                | 1–3s     |
| `sfx-lose.mp3`                | Game-over screen, only for the player who lost           | A gentle "aw" / comedic sad trombone     | 1–3s     |

On a tie, neither win nor lose sound plays.

## Where these are referenced in code

- `js/audio.js` — the `VOICELINES` array and `SFX` object list every
  filename above. If you want to rename a file, change it there too.
- `app.js` — calls `AudioFX.playX()` at the relevant game moments
  (turn start, timer countdown, correct guess, game over).

## Autoplay note

Mobile browsers block audio from playing before the user has interacted
with the page at least once. The very first sound might silently fail
to play if triggered before any tap — this is normal browser behavior,
not a bug, and everything works normally after that first tap anywhere
on the page.
