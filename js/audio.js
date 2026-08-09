// ===== audio.js — Sound effects manager =====
//
// Every sound is a placeholder path under public/audio/ — the actual
// .mp3 files aren't included, drop your own files in with these exact
// names and everything just works. See public/audio/README.md for the
// full list + suggested style/length for each one.
//
// Voicelines are meant to be heard by BOTH players at once (it's a meme
// button, half the fun is your friend hearing it too) — app.js sends a
// tiny { type: 'voiceline', id } message and both clients play locally
// from their own copy of the file (audio itself is never streamed over
// the WebRTC data channel, just the trigger).

const AudioFX = (() => {
  const BASE = 'public/audio/';

  // ---- Meme voicelines: shown in the radial FAB menu, 5 slots ----
  const VOICELINES = [
    { id: 'nice',      label: '👏 Nice!',       file: 'voiceline-nice.mp3' },
    { id: 'bruh',      label: '😐 Bruh',        file: 'voiceline-bruh.mp3' },
    { id: 'wow',       label: '😲 Wow',         file: 'voiceline-wow.mp3' },
    { id: 'laugh',     label: '😂 Laugh',       file: 'voiceline-laugh.mp3' },
    { id: 'airhorn',   label: '📣 Airhorn',     file: 'voiceline-airhorn.mp3' },
  ];

  // ---- System sound effects ----
  const SFX = {
    roundCountdown: 'sfx-round-countdown.mp3', // plays during the last 3 seconds of the timer
    turnStart:      'sfx-turn-start.mp3',       // short chime when a new turn begins
    correctGuess:   'sfx-correct-guess.mp3',    // plays the instant a guess is confirmed correct
    win:            'sfx-win.mp3',              // plays on the game-over screen for the winner
    lose:           'sfx-lose.mp3',             // plays on the game-over screen for the loser
  };

  const cache = {};
  let muted = false;

  function load(file) {
    if (!cache[file]) {
      const audio = new Audio(BASE + file);
      audio.preload = 'auto';
      cache[file] = audio;
    }
    return cache[file];
  }

  function play(file) {
    if (muted) return;
    try {
      const el = load(file);
      // Clone so rapid repeat taps (e.g. spamming a voiceline) don't cut
      // off the previous playback — each play gets its own instance.
      const instance = el.cloneNode();
      instance.play().catch(() => {
        // Autoplay can be blocked until the user has interacted with the
        // page at least once — safe to ignore, the next tap will work.
      });
    } catch (e) {
      // Missing/broken audio file — fail silently so a placeholder gap
      // never breaks the actual game.
    }
  }

  return {
    VOICELINES,

    playVoiceline(id) {
      const v = VOICELINES.find(v => v.id === id);
      if (v) play(v.file);
    },

    playRoundCountdown() { play(SFX.roundCountdown); },
    playTurnStart() { play(SFX.turnStart); },
    playCorrectGuess() { play(SFX.correctGuess); },
    playWin() { play(SFX.win); },
    playLose() { play(SFX.lose); },

    setMuted(value) { muted = value; },
    isMuted() { return muted; },
  };
})();
