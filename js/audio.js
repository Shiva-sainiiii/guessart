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
  let sfxMuted = false;
  let voicelinesMuted = false;
  let audioUnlocked = false;

  function load(file) {
    if (!cache[file]) {
      const audio = new Audio(BASE + file);
      audio.preload = 'auto';
      cache[file] = audio;
    }
    return cache[file];
  }

  function play(file, isVoiceline) {
    if (isVoiceline ? voicelinesMuted : sfxMuted) return;
    try {
      const el = load(file);
      // Clone so rapid repeat taps (e.g. spamming a voiceline) don't cut
      // off the previous playback — each play gets its own instance.
      const instance = el.cloneNode();
      instance.play().catch(() => {
        // Mobile browsers block audio.play() on any element that hasn't
        // been "unlocked" by a direct user gesture yet. This is exactly
        // why a REMOTELY-triggered voiceline (arriving over the data
        // channel, not from your own tap) can silently fail on one
        // side: that side's audio context was never unlocked by a
        // local click, only the other player's was. unlockAudioContext()
        // below fixes this by unlocking on the very first tap anywhere
        // in the app, before any remote trigger can arrive.
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
      if (v) play(v.file, true);
    },

    playRoundCountdown() { play(SFX.roundCountdown, false); },
    playTurnStart() { play(SFX.turnStart, false); },
    playCorrectGuess() { play(SFX.correctGuess, false); },
    playWin() { play(SFX.win, false); },
    playLose() { play(SFX.lose, false); },

    // Kept for compatibility — mutes both categories at once.
    setMuted(value) { sfxMuted = value; voicelinesMuted = value; },
    isMuted() { return sfxMuted && voicelinesMuted; },

    toggleSfx() { sfxMuted = !sfxMuted; return !sfxMuted; },
    toggleVoicelines() { voicelinesMuted = !voicelinesMuted; return !voicelinesMuted; },
    isSfxOn() { return !sfxMuted; },
    isVoicelinesOn() { return !voicelinesMuted; },

    // Call once on the very first tap/touch anywhere in the app (see
    // app.js). Silently plays and immediately pauses every cached sound
    // at zero volume — this satisfies the browser's "user gesture"
    // requirement for THIS audio element specifically, so later plays
    // triggered by an incoming network message (which is not itself a
    // user gesture) are allowed to go through instead of being blocked.
    unlockAudioContext() {
      if (audioUnlocked) return;
      audioUnlocked = true;
      const allFiles = [...VOICELINES.map(v => v.file), ...Object.values(SFX)];
      allFiles.forEach(file => {
        try {
          const el = load(file);
          el.volume = 0;
          const p = el.play();
          if (p && p.then) {
            p.then(() => { el.pause(); el.currentTime = 0; el.volume = 1; }).catch(() => {});
          }
        } catch (e) { /* ignore — this file just stays locked until first real play */ }
      });
    },
  };
})();
