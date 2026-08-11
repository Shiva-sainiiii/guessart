// ===== clues.js — Rotating text hints for the guesser =====
//
// The drawer's client looks up the 2-3 clue sentences for the secret
// word (from words.js) and cycles through them on a timer, sending each
// one to the guesser as a small { type: 'clue', text } message. The
// guesser never gets the word — clues are hand-written to avoid
// containing it, same trust model as hints.js.

const ClueSystem = (() => {
  const CYCLE_SECONDS = 12; // how long each clue stays on screen before rotating to the next

  let clues = [];
  let cycleIndex = 0;
  let cycleTimer = null;
  let sendClue = null; // drawer-only callback(text)

  function render(text) {
    const el = document.getElementById('clue-line');
    if (!el) return;
    if (!text) {
      el.textContent = '';
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    // Small fade so each new clue feels like a fresh hint, not a jump-cut.
    el.classList.remove('clue-fade-in');
    void el.offsetWidth; // restart the CSS animation
    el.innerHTML = `<svg class="icon icon-inline" width="14" height="14"><use href="#icon-bulb"/></svg> ${escapeHtmlClue(text)}`;
    el.classList.add('clue-fade-in');
  }

  // Clues are hand-authored (not user input), but escaping defensively
  // costs nothing and protects against any future clue text containing
  // special characters from breaking the innerHTML render.
  function escapeHtmlClue(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    // Drawer's client: word is looked up for its clue list and the
    // rotation begins immediately (first clue after a short delay so it
    // doesn't compete with the "your turn" message).
    startForDrawer(word, onClue) {
      clues = (typeof getCluesForWord === 'function' ? getCluesForWord(word) : []) || [];
      cycleIndex = 0;
      sendClue = onClue;
      clearInterval(cycleTimer);

      if (clues.length === 0) return;

      const fireNext = () => {
        const text = clues[cycleIndex % clues.length];
        cycleIndex++;
        sendClue && sendClue(text);
      };

      setTimeout(fireNext, 4000); // let the guesser look at the drawing first
      cycleTimer = setInterval(fireNext, CYCLE_SECONDS * 1000);
    },

    // Guesser's client: just clears any leftover clue line, waiting for
    // the drawer's messages to populate it.
    startForGuesser() {
      clues = [];
      render(null);
    },

    // Drawer never shows the clue line themselves — they already see the word.
    hideForDrawer() {
      const el = document.getElementById('clue-line');
      if (el) { el.textContent = ''; el.classList.add('hidden'); }
    },

    // Guesser-side: paint a clue that just arrived over the wire.
    applyRemoteClue(text) {
      render(text);
    },

    stop() {
      clearInterval(cycleTimer);
      cycleTimer = null;
      clues = [];
      cycleIndex = 0;
      render(null);
    },
  };
})();
