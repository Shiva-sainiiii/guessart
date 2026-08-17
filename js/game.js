// ===== game.js — Turn management, timer, scoring, chat/guess detection =====

const Game = (() => {
  const TOTAL_ROUNDS = 8; // 4 turns each, keeps sessions short and punchy
  const ROUND_SECONDS = 70;

  let myScore = 0;
  let friendScore = 0;
  let currentRound = 0;
  let isMyTurn = false;
  let currentWord = null; // only set locally for the drawer
  let usedWords = [];
  let timerInterval = null;
  let timeLeft = 0;
  let roundActive = false;

  // UI callbacks wired up by app.js
  let callbacks = {};

  function startTurn(drawerIsMe, word) {
    currentRound++;
    isMyTurn = drawerIsMe;
    roundActive = true;
    timeLeft = ROUND_SECONDS;
    DrawCanvas.clear();
    DrawCanvas.setCanDraw(drawerIsMe);

    if (drawerIsMe) {
      currentWord = word;
      usedWords.push(word);
    } else {
      currentWord = null; // guesser doesn't know it
    }

    callbacks.onTurnStart && callbacks.onTurnStart({
      round: currentRound,
      totalRounds: TOTAL_ROUNDS,
      isMyTurn: drawerIsMe,
      word: drawerIsMe ? word : null,
    });

    startTimer();
  }

  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timeLeft--;
      callbacks.onTimerTick && callbacks.onTimerTick(timeLeft);
      if (timeLeft <= 0) {
        endRound(false, null);
      }
    }, 1000);
  }

  function endRound(wasGuessed, guesserIsMe) {
    if (!roundActive) return;
    roundActive = false;
    clearInterval(timerInterval);

    const revealedWord = currentWord;

    if (wasGuessed) {
      const speedBonus = Math.max(10, Math.floor((timeLeft / ROUND_SECONDS) * 50));
      const guesserPoints = 50 + speedBonus;
      const drawerPoints = 30;

      if (guesserIsMe) {
        myScore += guesserPoints;
        friendScore += drawerPoints;
      } else {
        friendScore += guesserPoints;
        myScore += drawerPoints;
      }
    }

    callbacks.onRoundEnd && callbacks.onRoundEnd({
      wasGuessed,
      word: revealedWord,
      myScore,
      friendScore,
    });

    if (currentRound >= TOTAL_ROUNDS) {
      setTimeout(() => {
        callbacks.onGameEnd && callbacks.onGameEnd({ myScore, friendScore });
      }, 2500);
    }
  }

  function normalizeGuess(text) {
    // Strip ALL whitespace (not just collapse it) so multi-word answers
    // like "ice cream" match even if the guesser typed "icecream" or
    // "rain bow" for "rainbow" — spacing shouldn't be what trips up a
    // correct guess.
    //
    // Also strip common punctuation ("ice-cream", "icecream!", "pizza?",
    // "it's a ghost." typed sloppily) and normalize accented Latin
    // letters to their plain equivalents (café -> cafe) via Unicode
    // NFD decomposition + stripping combining diacritical marks — none
    // of the current WORD_LIST entries use accents, but this keeps a
    // guesser from being penalized by autocorrect/IME-inserted accents
    // or curly quotes their keyboard added without them noticing.
    // Word-internal characters that are never meaningful in an English
    // word/guess (.,!?'"-_) are removed rather than treated as part of
    // the answer; this never over-matches two DIFFERENT words in
    // WORD_LIST, since none of them are punctuation-adjacent minimal
    // pairs (no "ice-cream" vs "ice.cream" style collisions exist here).
    return text
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
      .trim()
      .toLowerCase()
      .replace(/[.,!?'"''""\-_]/g, '') // strip common punctuation
      .replace(/\s+/g, ''); // strip all remaining whitespace
  }

  return {
    init(cbs) {
      callbacks = cbs;
    },

    beginGame(hostGoesFirst) {
      currentRound = 0;
      myScore = 0;
      friendScore = 0;
      usedWords = [];
      isMyTurn = hostGoesFirst;
    },

    startMyTurnAsDrawer() {
      const word = getRandomWord(usedWords);
      startTurn(true, word);
      return word;
    },

    startMyTurnAsGuesser() {
      startTurn(false, null);
    },

    // Drawer-side check: does this incoming guess match my secret word?
    drawerChecksGuess(text) {
      if (!roundActive || !isMyTurn || !currentWord) return false;
      return normalizeGuess(text) === normalizeGuess(currentWord);
    },

    endRoundGuessed(guesserIsMe) {
      endRound(true, guesserIsMe);
    },

    endRoundTimeout() {
      endRound(false, null);
    },

    getState() {
      return {
        currentRound, TOTAL_ROUNDS, isMyTurn, timeLeft,
        myScore, friendScore, roundActive, currentWord,
      };
    },

    getCurrentWord() { return currentWord; },
    isDrawerTurn() { return isMyTurn; },
    getRoundNumber() { return currentRound; },
    getTotalRounds() { return TOTAL_ROUNDS; },
    isRoundActive() { return roundActive; },
    // Exposed so a solo vs-computer session (see js/bot.js) can avoid
    // picking a word for the bot's turn that the human already drew
    // earlier in the same game.
    getUsedWords() { return usedWords.slice(); },
    // The reverse direction: called once a round the BOT drew ends and
    // its secret word is revealed to the human (via 'correct_guess' or
    // 'timeout'), so a later human-drawer turn in the same game doesn't
    // pick the exact word the bot already used.
    markWordUsed(word) {
      if (word && !usedWords.includes(word)) usedWords.push(word);
    },

    destroy() {
      clearInterval(timerInterval);
    },
  };
})();
