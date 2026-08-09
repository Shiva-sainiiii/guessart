// ===== hints.js — Progressive hint reveal for the guesser =====
//
// The DRAWER's client is authoritative for hints, since it's the only
// client that actually holds the secret word. On turn start it computes
// the full reveal schedule (which letter unlocks at which point in the
// timer) up front, then as the timer ticks it sends small
// { type: 'hint_reveal', index, letter } messages to the guesser.
// The guesser's client is a pure renderer: it never sees the word, only
// the individual letters as they're explicitly handed to it.

const HintSystem = (() => {
  const MAX_REVEAL_FRACTION = 0.45; // never reveal more than ~45% of letters — stays a guessing game
  const REVEAL_STEPS = [0.75, 0.55, 0.35, 0.18]; // fractions of time-left at which one more letter unlocks

  // ---- shared render state (used by both drawer-computed and guesser-received reveals) ----
  let word = null;          // only ever set on the drawer's client
  let pattern = null;       // e.g. "LLL LLLLL" — 'L' = letter slot, ' ' = space (both clients have this)
  let tiles = null;         // array parallel to pattern: null = hidden, or the actual letter if revealed
  let revealOrder = [];     // drawer-only: indices in the order they'll be revealed
  let stepsFired = [];
  let totalSeconds = 70;
  let sendReveal = null;    // drawer-only callback(index, letter) to notify the guesser

  function wordToPattern(w) {
    return w.split('').map(ch => (ch === ' ' ? ' ' : 'L')).join('');
  }

  function lettersIdx(pat) {
    const idx = [];
    for (let i = 0; i < pat.length; i++) if (pat[i] !== ' ') idx.push(i);
    return idx;
  }

  function segmentEnds(pat) {
    // First and last letter index of each space-separated word segment.
    const ends = new Set();
    let segStart = 0;
    pat.split(' ').forEach(seg => {
      if (seg.length > 0) {
        ends.add(segStart);
        ends.add(segStart + seg.length - 1);
      }
      segStart += seg.length + 1;
    });
    return ends;
  }

  function render() {
    const el = document.getElementById('hint-tiles');
    if (!el || !pattern) return;
    el.innerHTML = pattern.split('').map((c, i) => {
      if (c === ' ') return '<span class="hint-gap"></span>';
      const shown = tiles ? tiles[i] : null;
      return `<span class="hint-tile${shown ? ' revealed' : ''}">${shown ? shown : ''}</span>`;
    }).join('');
  }

  return {
    // Called on the DRAWER's client at turn start. Computes the reveal
    // schedule locally (never sent over the wire). The drawer doesn't
    // render the tile row themselves — they already see the real word
    // in the banner.
    setupForDrawer(theWord, onReveal, roundSeconds = 70) {
      word = theWord;
      pattern = wordToPattern(word);
      totalSeconds = roundSeconds;
      sendReveal = onReveal;
      stepsFired = REVEAL_STEPS.map(() => false);

      const ends = segmentEnds(pattern);
      const remaining = lettersIdx(pattern).filter(i => !ends.has(i));
      // Shuffle remaining indices so the reveal order is unpredictable.
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      const maxAllowed = Math.floor(lettersIdx(pattern).length * MAX_REVEAL_FRACTION) - ends.size;
      revealOrder = remaining.slice(0, Math.max(0, maxAllowed));

      const wrap = document.getElementById('hint-wrap');
      if (wrap) wrap.classList.add('hidden');
    },

    // Called on the GUESSER's client when 'word_length' arrives.
    setupForGuesser(pat, roundSeconds = 70) {
      word = null;
      pattern = pat;
      totalSeconds = roundSeconds;
      tiles = new Array(pattern.length).fill(null);

      const wrap = document.getElementById('hint-wrap');
      if (wrap) wrap.classList.remove('hidden');
      render();
    },

    // Drawer calls this immediately after setupForDrawer so its own
    // instant end-letter reveals go out over the wire too.
    revealEnds() {
      if (!word) return; // drawer-only
      const ends = [...segmentEnds(pattern)];
      ends.forEach(i => sendReveal && sendReveal(i, word[i]));
    },

    // Call every timer tick — on the drawer this decides + sends new
    // reveals; on the guesser this is a no-op (they just render what
    // arrives via applyRemoteReveal).
    onTimerTick(secondsLeft) {
      if (!word || !pattern) return; // only the drawer drives reveals
      const fraction = secondsLeft / totalSeconds;
      REVEAL_STEPS.forEach((threshold, i) => {
        if (!stepsFired[i] && fraction <= threshold && revealOrder.length > 0) {
          stepsFired[i] = true;
          const idx = revealOrder.shift();
          sendReveal && sendReveal(idx, word[idx]);
        }
      });
    },

    // Guesser-side: paint a letter that the drawer just revealed.
    applyRemoteReveal(index, letter) {
      if (!tiles) return;
      tiles[index] = letter;
      render();
    },

    hideForDrawer() {
      word = null;
      pattern = null;
      const wrap = document.getElementById('hint-wrap');
      if (wrap) wrap.classList.add('hidden');
    },

    reset() {
      word = null;
      pattern = null;
      tiles = null;
      revealOrder = [];
    },
  };
})();
