// ===== bot.js — "Play with Computer" brain engine (fully offline, no API) =====
//
// Design goal: the REST of the app (game.js, canvas.js, hints.js, clues.js,
// app.js's message handling) already speaks one protocol — small JSON
// messages passed through Connection.send()/Connection.onMessage(). Rather
// than special-casing "is this a bot game?" all over app.js, BotPeer below
// impersonates Connection's public interface. app.js talks to it exactly
// the same way it talks to a real WebRTC peer; the bot's replies come back
// through the same onMessage() pipe a real friend's messages would.
// This is also exactly the shape a future OpenRouter-backed brain would
// need to fill (see BotBrain.chooseGuess / BotBrain.planDrawing below —
// swap their internals for an API call later, the wiring here doesn't change).
//
// Two responsibilities live here:
//   1. BotBrain — the "intelligence": decides what to draw (a list of canvas
//      strokes for a word) and decides what to type as a guess given the
//      hints/clues it has received so far.
//   2. BotPeer  — the "network stand-in": has the same shape as Connection
//      (send/onMessage/onOpen/isConnected/destroy...) but instead of going
//      over WebRTC, it just calls BotBrain locally and echoes results back
//      through its own message handlers on a short randomized delay (so it
//      doesn't feel like an instant, robotic reflex).

// ---------------------------------------------------------------------
// BotBrain — drawing templates + guessing heuristics
// ---------------------------------------------------------------------
const BotBrain = (() => {

  // ---- Shape primitives (normalized 0-1 coordinate space, same as DrawCanvas) ----
  // Each primitive returns an array of stroke segments: {x1,y1,x2,y2}.
  // Strokes are later given a color/width and paced out over time so the
  // drawing appears progressively, like a real player sketching.

  function lerp(a, b, t) { return a + (b - a) * t; }

  function lineSeg(x1, y1, x2, y2, steps = 1) {
    // Break a straight line into small segments so it can be paced out
    // stroke-by-stroke like real freehand drawing, instead of appearing instantly.
    const segs = [];
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps, t1 = (i + 1) / steps;
      segs.push({ x1: lerp(x1, x2, t0), y1: lerp(y1, y2, t0), x2: lerp(x1, x2, t1), y2: lerp(y1, y2, t1) });
    }
    return segs;
  }

  function circle(cx, cy, r, steps = 24) {
    const segs = [];
    for (let i = 0; i < steps; i++) {
      const a0 = (i / steps) * Math.PI * 2;
      const a1 = ((i + 1) / steps) * Math.PI * 2;
      segs.push({
        x1: cx + Math.cos(a0) * r, y1: cy + Math.sin(a0) * r,
        x2: cx + Math.cos(a1) * r, y2: cy + Math.sin(a1) * r,
      });
    }
    return segs;
  }

  function ellipse(cx, cy, rx, ry, steps = 24) {
    const segs = [];
    for (let i = 0; i < steps; i++) {
      const a0 = (i / steps) * Math.PI * 2;
      const a1 = ((i + 1) / steps) * Math.PI * 2;
      segs.push({
        x1: cx + Math.cos(a0) * rx, y1: cy + Math.sin(a0) * ry,
        x2: cx + Math.cos(a1) * rx, y2: cy + Math.sin(a1) * ry,
      });
    }
    return segs;
  }

  function polyline(points, steps = 1) {
    const segs = [];
    for (let i = 0; i < points.length - 1; i++) {
      segs.push(...lineSeg(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], steps));
    }
    return segs;
  }

  function rect(x, y, w, h) {
    return polyline([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]);
  }

  function triangle(x1, y1, x2, y2, x3, y3) {
    return polyline([[x1, y1], [x2, y2], [x3, y3], [x1, y1]]);
  }

  // ---- Curated templates: hand-placed primitives for common/easy words ----
  // Each template is a function() -> array of {segs, color, width}
  // "groups" — grouping lets the pacer send a whole recognizable part
  // (e.g. the whole head) as one visual beat rather than one segment at a time.
  const BLACK = '#1a1a22';

  const TEMPLATES = {
    chair: () => [
      { segs: rect(0.35, 0.35, 0.3, 0.3), color: BLACK, width: 4 },
      { segs: polyline([[0.35, 0.35], [0.35, 0.15]]), color: BLACK, width: 4 },
      { segs: polyline([[0.65, 0.35], [0.65, 0.15]]), color: BLACK, width: 4 },
      { segs: polyline([[0.35, 0.15], [0.65, 0.15]]), color: BLACK, width: 4 },
      { segs: polyline([[0.37, 0.65], [0.37, 0.85]]), color: BLACK, width: 4 },
      { segs: polyline([[0.63, 0.65], [0.63, 0.85]]), color: BLACK, width: 4 },
    ],
    umbrella: () => [
      { segs: [...ellipse(0.5, 0.4, 0.25, 0.15, 20)].filter(s => s.y1 <= 0.42 || s.y2 <= 0.42), color: BLACK, width: 4 },
      { segs: polyline([[0.25, 0.4], [0.5, 0.15], [0.75, 0.4]]), color: BLACK, width: 4 },
      { segs: polyline([[0.5, 0.15], [0.5, 0.8]]), color: BLACK, width: 4 },
      { segs: polyline([[0.5, 0.8], [0.45, 0.85], [0.5, 0.88]]), color: BLACK, width: 4 },
    ],
    clock: () => [
      { segs: circle(0.5, 0.5, 0.28), color: BLACK, width: 4 },
      { segs: polyline([[0.5, 0.5], [0.5, 0.3]]), color: BLACK, width: 3 },
      { segs: polyline([[0.5, 0.5], [0.65, 0.55]]), color: BLACK, width: 3 },
    ],
    key: () => [
      { segs: circle(0.35, 0.4, 0.12), color: BLACK, width: 4 },
      { segs: polyline([[0.47, 0.4], [0.75, 0.4]]), color: BLACK, width: 4 },
      { segs: polyline([[0.65, 0.4], [0.65, 0.5]]), color: BLACK, width: 3 },
      { segs: polyline([[0.75, 0.4], [0.75, 0.5]]), color: BLACK, width: 3 },
    ],
    pencil: () => [
      { segs: polyline([[0.3, 0.75], [0.7, 0.25]]), color: BLACK, width: 6 },
      { segs: triangle(0.68, 0.23, 0.76, 0.31, 0.7, 0.25), color: '#f4a300', width: 4 },
      { segs: polyline([[0.28, 0.77], [0.32, 0.73]]), color: BLACK, width: 3 },
    ],
    envelope: () => [
      { segs: rect(0.2, 0.3, 0.6, 0.4), color: BLACK, width: 4 },
      { segs: polyline([[0.2, 0.3], [0.5, 0.55], [0.8, 0.3]]), color: BLACK, width: 4 },
    ],
    ladder: () => [
      { segs: polyline([[0.35, 0.15], [0.3, 0.85]]), color: BLACK, width: 4 },
      { segs: polyline([[0.65, 0.15], [0.7, 0.85]]), color: BLACK, width: 4 },
      { segs: polyline([[0.32, 0.3], [0.68, 0.3]]), color: BLACK, width: 3 },
      { segs: polyline([[0.31, 0.5], [0.69, 0.5]]), color: BLACK, width: 3 },
      { segs: polyline([[0.31, 0.7], [0.69, 0.7]]), color: BLACK, width: 3 },
    ],
    balloon: () => [
      { segs: ellipse(0.5, 0.35, 0.2, 0.25), color: '#e63946', width: 4 },
      { segs: polyline([[0.5, 0.6], [0.5, 0.9]]), color: BLACK, width: 2 },
    ],
    sun: () => [
      { segs: circle(0.5, 0.5, 0.18), color: '#f4a300', width: 4 },
      ...[0, 45, 90, 135, 180, 225, 270, 315].map(a => ({
        segs: lineSeg(
          0.5 + Math.cos(a * Math.PI / 180) * 0.22, 0.5 + Math.sin(a * Math.PI / 180) * 0.22,
          0.5 + Math.cos(a * Math.PI / 180) * 0.32, 0.5 + Math.sin(a * Math.PI / 180) * 0.32
        ), color: '#f4a300', width: 3,
      })),
    ],
    cloud: () => [
      { segs: circle(0.4, 0.5, 0.13), color: BLACK, width: 4 },
      { segs: circle(0.55, 0.42, 0.16), color: BLACK, width: 4 },
      { segs: circle(0.68, 0.52, 0.11), color: BLACK, width: 4 },
    ],
    fish: () => [
      { segs: ellipse(0.42, 0.5, 0.22, 0.13), color: '#3a86ff', width: 4 },
      { segs: triangle(0.63, 0.5, 0.78, 0.38, 0.78, 0.62), color: '#3a86ff', width: 4 },
      { segs: circle(0.3, 0.47, 0.02), color: BLACK, width: 3 },
    ],
    guitar: () => [
      { segs: ellipse(0.5, 0.65, 0.18, 0.2), color: '#8338ec', width: 4 },
      { segs: ellipse(0.5, 0.35, 0.1, 0.12), color: '#8338ec', width: 4 },
      { segs: polyline([[0.5, 0.15], [0.5, 0.25]]), color: BLACK, width: 4 },
    ],
    bicycle: () => [
      { segs: circle(0.28, 0.65, 0.15), color: BLACK, width: 3 },
      { segs: circle(0.72, 0.65, 0.15), color: BLACK, width: 3 },
      { segs: polyline([[0.28, 0.65], [0.5, 0.4], [0.72, 0.65]]), color: BLACK, width: 3 },
      { segs: polyline([[0.5, 0.4], [0.42, 0.65]]), color: BLACK, width: 3 },
      { segs: polyline([[0.5, 0.4], [0.55, 0.3]]), color: BLACK, width: 3 },
    ],
    house: () => [
      { segs: rect(0.3, 0.5, 0.4, 0.35), color: BLACK, width: 4 },
      { segs: triangle(0.25, 0.5, 0.5, 0.25, 0.75, 0.5), color: BLACK, width: 4 },
      { segs: rect(0.45, 0.65, 0.1, 0.2), color: BLACK, width: 3 },
    ],
    star: () => {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 0.25 : 0.11;
        const a = -Math.PI / 2 + i * Math.PI / 5;
        pts.push([0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r]);
      }
      pts.push(pts[0]);
      return [{ segs: polyline(pts), color: '#f4a300', width: 4 }];
    },
    heart: () => [
      { segs: polyline([
        [0.5, 0.75], [0.2, 0.45], [0.2, 0.3], [0.35, 0.22], [0.5, 0.35],
        [0.65, 0.22], [0.8, 0.3], [0.8, 0.45], [0.5, 0.75],
      ], 3), color: '#e63946', width: 4 },
    ],
    snowman: () => [
      { segs: circle(0.5, 0.7, 0.18), color: BLACK, width: 3 },
      { segs: circle(0.5, 0.45, 0.13), color: BLACK, width: 3 },
      { segs: circle(0.5, 0.27, 0.09), color: BLACK, width: 3 },
    ],
    banana: () => [
      { segs: polyline([[0.3, 0.3], [0.25, 0.5], [0.35, 0.7], [0.55, 0.75], [0.7, 0.65]], 4), color: '#f4a300', width: 6 },
    ],
    mountain: () => [
      { segs: polyline([[0.15, 0.75], [0.4, 0.3], [0.55, 0.5], [0.7, 0.25], [0.9, 0.75]]), color: BLACK, width: 4 },
    ],
    rainbow: () => {
      const colors = ['#e63946', '#f4a300', '#2a9d8f', '#3a86ff', '#8338ec'];
      return colors.map((c, i) => ({
        segs: (() => {
          const segs = [];
          const r = 0.35 - i * 0.045;
          for (let a = 180; a <= 360; a += 12) {
            const a0 = a * Math.PI / 180, a1 = (a + 12) * Math.PI / 180;
            segs.push({ x1: 0.5 + Math.cos(a0) * r, y1: 0.75 + Math.sin(a0) * r, x2: 0.5 + Math.cos(a1) * r, y2: 0.75 + Math.sin(a1) * r });
          }
          return segs;
        })(), color: c, width: 4,
      }));
    },
  };

  // ---- Generic category fallback for the ~120 words with no hand-drawn template ----
  // A recognizable "blob body + labelled parts" sketch is impossible to fake
  // meaningfully without real vision/generation, so the fallback focuses on
  // giving the human guesser useful SHAPE information (round/tall/legs/wings,
  // person-in-motion, landscape horizon, held object) inferred from simple
  // keyword rules, plus it leans harder on clue text (already shown via
  // ClueSystem) — a human bot opponent "cheats" a little less honestly than
  // a real friend anyway, so this is an acceptable trade.
  function genericSketch(word) {
    const w = word.toLowerCase();
    const isAnimal = /elephant|penguin|octopus|kangaroo|butterfly|spider|parrot|dolphin|crocodile|peacock|camel|squirrel|owl|snail|goat|tortoise|flamingo|hedgehog|koala|chameleon|walrus|jellyfish|rhinoceros|seahorse/.test(w);
    const isFood = /pizza|burger|cream|banana|melon|samosa|mango|noodles|pancake|donut|cupcake|chili|coconut|pineapple|popcorn|sandwich|strawberry|dumpling|pretzel|omelette|jalebi|popsicle|avocado|biscuit|chai|tiffin/.test(w);
    const isCreature = /dragon|robot|ghost|alien|wizard|mermaid|dinosaur|superhero|zombie|ninja|unicorn|vampire|genie|werewolf|pirate|mummy|fairy|yeti/.test(w);
    // -ing action words (dancing, running, juggling fire, time traveler...) —
    // a simple stick figure with limbs posed differently per verb reads as
    // "a person doing something", which is most of what these words need.
    const isAction = /ing$|ing\s|traveler/.test(w);
    // Landscape/nature words that aren't a single hand-drawable object but
    // ARE a horizon scene — ground line + one or two terrain features.
    const isNature = /volcano|waterfall|tornado|island|desert|cactus|lightning|campfire|iceberg|glacier|canyon|meadow|eclipse|geyser|reef|beehive/.test(w);
    // Small handheld/household objects: better served by a generic
    // "object silhouette on a shelf line" than an arbitrary crossed box.
    const isObject = /candle|hammer|scissors|backpack|camera|telephone|lamp|mirror|suitcase|helmet|glasses|wallet|shoe|toothbrush|pillow|broom|flashlight|necklace|kettle|calendar|wheelchair|kite|bucket|slipper|charger|fan\b|cooker|bag\b|signal|clothesline|rickshaw|train\b|temple|tank|card/.test(w);

    if (isAnimal || isCreature) {
      // Body blob + head + two legs + simple face — reads as "a creature", clue text carries the rest.
      return [
        { segs: ellipse(0.48, 0.6, 0.22, 0.15), color: BLACK, width: 4 },
        { segs: circle(0.48, 0.35, 0.13), color: BLACK, width: 4 },
        { segs: polyline([[0.35, 0.72], [0.33, 0.85]]), color: BLACK, width: 3 },
        { segs: polyline([[0.6, 0.72], [0.62, 0.85]]), color: BLACK, width: 3 },
        { segs: circle(0.44, 0.33, 0.015), color: BLACK, width: 3 },
        { segs: circle(0.53, 0.33, 0.015), color: BLACK, width: 3 },
      ];
    }
    if (isFood) {
      // Round plate/blob — generic "food on a plate" read.
      return [
        { segs: circle(0.5, 0.55, 0.28), color: '#e63946', width: 4 },
        { segs: circle(0.5, 0.55, 0.32), color: BLACK, width: 2 },
      ];
    }
    if (isAction) {
      // Basic stick figure with raised/spread limbs — enough shape info
      // to say "a person doing an active thing", which combined with the
      // clue sentences narrows it down fast.
      return [
        { segs: circle(0.5, 0.28, 0.08), color: BLACK, width: 3 },       // head
        { segs: polyline([[0.5, 0.36], [0.5, 0.6]]), color: BLACK, width: 3 }, // torso
        { segs: polyline([[0.5, 0.42], [0.32, 0.3]]), color: BLACK, width: 3 }, // arm up
        { segs: polyline([[0.5, 0.42], [0.68, 0.55]]), color: BLACK, width: 3 }, // arm out
        { segs: polyline([[0.5, 0.6], [0.35, 0.85]]), color: BLACK, width: 3 },  // leg
        { segs: polyline([[0.5, 0.6], [0.65, 0.82]]), color: BLACK, width: 3 },  // leg (mid-stride)
      ];
    }
    if (isNature) {
      // Ground line + a simple terrain silhouette — reads as "outdoor
      // landscape thing" even without nailing the specific feature.
      return [
        { segs: polyline([[0.1, 0.78], [0.9, 0.78]]), color: BLACK, width: 3 }, // horizon
        { segs: polyline([[0.3, 0.78], [0.45, 0.35], [0.6, 0.78]]), color: BLACK, width: 4 }, // terrain rise
        { segs: circle(0.72, 0.3, 0.07), color: '#f4a300', width: 3 }, // sun/orb accent
      ];
    }
    if (isObject) {
      // Rounded rect "device/item silhouette" reads more like a held
      // object than the plain crossed box, without pretending to know
      // its exact form.
      return [
        { segs: rect(0.32, 0.28, 0.36, 0.44), color: BLACK, width: 4 },
        { segs: circle(0.5, 0.5, 0.08), color: BLACK, width: 2 },
        { segs: polyline([[0.32, 0.4], [0.68, 0.4]]), color: BLACK, width: 2 },
      ];
    }
    // Ultimate fallback: a labelled box shape — at minimum gives the
    // guesser something on-screen to pair with the clue text/hints.
    return [
      { segs: rect(0.3, 0.35, 0.4, 0.35), color: BLACK, width: 4 },
      { segs: polyline([[0.3, 0.35], [0.7, 0.7]]), color: BLACK, width: 2 },
      { segs: polyline([[0.7, 0.35], [0.3, 0.7]]), color: BLACK, width: 2 },
    ];
  }

  // Simple singular-vs-multiword lookup: templates are keyed by the exact
  // word, but also try the first token (helps e.g. "cricket bat" -> no
  // direct hit, falls through to generic, which is fine).
  function templateFor(word) {
    const key = word.toLowerCase().trim();
    if (TEMPLATES[key]) return TEMPLATES[key]();
    return genericSketch(key);
  }

  // ---- Guessing brain ----
  // Tracks what the bot currently knows about the secret word: the
  // letter/space pattern, any letters revealed so far, and every clue
  // sentence it's received. Produces a best-effort guess string.
  function makeGuesserState() {
    return {
      pattern: null,        // e.g. "LLLLL"
      revealed: {},         // index -> letter
      clueWords: [],         // keyword pool harvested from clue sentences
      triedGuesses: new Set(),
    };
  }

  const STOPWORDS = new Set(['it', 'its', 'a', 'an', 'the', 'you', 'your', 'is', 'are', 'to', 'in', 'on', 'at', 'of',
    'and', 'or', 'has', 'have', 'with', 'that', 'this', 'they', 'them', 'often', 'usually', 'sometimes',
    'people', 'can', 'used', 'use', 'for', 'like', 'from', 'up', 'down', 'over', 'not', 'be', 'as', 'when',
    'than', 'their', 'were', 'was', 'do', 'does', 'many', 'most', 'some', 'without', 'before', 'after']);

  // Score every candidate word in the full list against the pattern +
  // clue keyword overlap, returning the best match the bot hasn't tried yet.
  function bestCandidate(state) {
    if (typeof WORD_LIST === 'undefined') return null;
    const clueSet = new Set(state.clueWords);

    let best = null, bestScore = -Infinity;
    for (const entry of WORD_LIST) {
      const w = entry.word.toLowerCase();
      if (state.triedGuesses.has(w)) continue;
      if (state.pattern) {
        const norm = w.replace(/\s+/g, '');
        const patLetters = state.pattern.replace(/\s+/g, '');
        if (norm.length !== patLetters.length) continue;
        // Must match every already-revealed letter position exactly.
        let ok = true;
        let flatIdx = 0;
        for (let i = 0; i < state.pattern.length; i++) {
          if (state.pattern[i] === ' ') continue;
          if (state.revealed[i] && state.revealed[i].toLowerCase() !== norm[flatIdx]) { ok = false; break; }
          flatIdx++;
        }
        if (!ok) continue;
      }
      // Keyword overlap score: how many of this candidate's own clue
      // words appear in the clues the bot has actually received.
      const candClues = (entry.clues || []).join(' ').toLowerCase().match(/[a-z]+/g) || [];
      let score = 0;
      candClues.forEach(t => { if (clueSet.has(t) && !STOPWORDS.has(t)) score += 1; });
      // Small tie-break bonus for revealed-letter matches (already
      // guaranteed above, but rewards longer confirmed matches).
      score += Object.keys(state.revealed).length * 0.1;

      if (score > bestScore) { bestScore = score; best = w; }
    }
    return best;
  }

  return {
    TEMPLATES_AVAILABLE: Object.keys(TEMPLATES),

    // Returns an ordered list of drawing "beats" for the bot-as-drawer to
    // paint out over the round. Each beat: { segs: [...], color, width }.
    planDrawing(word) {
      return templateFor(word);
    },

    newGuesserState: makeGuesserState,

    ingestPattern(state, pattern) {
      state.pattern = pattern;
    },
    ingestReveal(state, index, letter) {
      state.revealed[index] = letter;
    },
    ingestClue(state, text) {
      const tokens = (text.toLowerCase().match(/[a-z]+/g) || []).filter(t => !STOPWORDS.has(t) && t.length > 2);
      state.clueWords.push(...tokens);
    },

    // Decide whether/what to guess right now. Returns a string to send as
    // a chat guess, or null to stay quiet this tick (keeps the bot from
    // spamming a guess every single second).
    chooseGuess(state) {
      const guess = bestCandidate(state);
      if (!guess) return null;
      state.triedGuesses.add(guess);
      return guess;
    },
  };
})();

// ---------------------------------------------------------------------
// BotPeer — stands in for Connection when playing solo vs the computer
// ---------------------------------------------------------------------
const BotPeer = (() => {
  let messageHandlers = [];
  let onOpenHandlers = [];
  let botName = 'GuessArt Bot';
  let connected = false;

  // Bot-side game shadow state — the bot needs to independently know
  // whose turn it is and what the secret word is (when IT is drawing),
  // since it isn't running its own copy of Game/HintSystem/ClueSystem.
  let botIsDrawer = false;
  let secretWord = null;
  let guesserState = null;
  let drawTimer = null;
  let guessTimer = null;
  let roundTimeoutTimer = null;
  let roundOver = false;
  let drawQueue = [];

  const ROUND_SECONDS = 70; // must match Game's ROUND_SECONDS (js/game.js) so bot-as-drawer timeouts land at the same moment the human's own timer UI hits 0

  function emit(data) {
    // Simulate real network latency so bot messages don't feel instant/robotic.
    const delay = 250 + Math.random() * 400;
    setTimeout(() => {
      messageHandlers.forEach(fn => fn(data));
    }, delay);
  }

  function clearTimers() {
    clearTimeout(drawTimer);
    clearTimeout(guessTimer);
    clearTimeout(roundTimeoutTimer);
    drawQueue = [];
    roundOver = false;
  }

  // Paces out the bot's drawing plan as a sequence of stroke messages,
  // spread across most of the round so it doesn't finish instantly.
  function startBotDrawing(word) {
    const beats = BotBrain.planDrawing(word);
    drawQueue = [];
    beats.forEach(beat => {
      beat.segs.forEach(seg => {
        drawQueue.push(Object.assign({ color: beat.color, width: beat.width, erase: false }, seg));
      });
    });

    // Send the word-length pattern immediately (matches a real drawer's flow).
    emit({ type: 'word_length', pattern: word.split('').map(ch => (ch === ' ' ? ' ' : 'L')).join('') });

    // Reveal first+last letters instantly, same as HintSystem.revealEnds().
    const ends = new Set();
    let segStart = 0;
    word.split(' ').forEach(seg => {
      if (seg.length > 0) { ends.add(segStart); ends.add(segStart + seg.length - 1); }
      segStart += seg.length + 1;
    });
    ends.forEach(i => emit({ type: 'hint_reveal', index: i, letter: word[i] }));

    // Send a clue every ~12s, mirroring ClueSystem's pacing.
    const clues = (typeof getCluesForWord === 'function' ? getCluesForWord(word) : []) || [];
    clues.forEach((text, i) => {
      setTimeout(() => emit({ type: 'clue', text }), 4000 + i * 12000);
    });

    // Drip out strokes over roughly 45 seconds so the sketch builds up
    // progressively instead of appearing all at once.
    const totalMs = 45000;
    const perStroke = Math.max(60, totalMs / Math.max(1, drawQueue.length));
    let i = 0;
    function tick() {
      if (i >= drawQueue.length || roundOver) return;
      emit({ type: 'stroke', x1: drawQueue[i].x1, y1: drawQueue[i].y1, x2: drawQueue[i].x2, y2: drawQueue[i].y2, color: drawQueue[i].color, width: drawQueue[i].width, erase: false });
      i++;
      drawTimer = setTimeout(tick, perStroke + (Math.random() * 40 - 20));
    }
    drawTimer = setTimeout(tick, 500);

    // When the bot is drawing, IT is the "drawer's client" and so must be
    // the one authoritative for a timeout, exactly like Game.js's own
    // onTimerTick() is for a human drawer (see app.js). Without this, a
    // round where the bot draws and the human never guesses correctly
    // would simply hang forever — Game.isDrawerTurn() is false on the
    // human's client in that turn (they're the guesser), so the human's
    // own timeout check never fires either.
    roundTimeoutTimer = setTimeout(() => {
      if (roundOver) return;
      roundOver = true;
      emit({ type: 'timeout', word: secretWord });
    }, ROUND_SECONDS * 1000);
  }

  // Bot-as-guesser: periodically evaluate whether it has enough signal
  // to take a guess, with human-like variable timing (not every second).
  function startBotGuessing() {
    guesserState = BotBrain.newGuesserState();
    function tick() {
      const delay = 4000 + Math.random() * 5000;
      guessTimer = setTimeout(() => {
        const guess = BotBrain.chooseGuess(guesserState);
        if (guess) {
          emit({ type: 'chat', text: guess, name: botName, msgId: 'bot' + Date.now() });
        }
        tick();
      }, delay);
    }
    tick();
  }

  return {
    setBotName(name) { botName = name || 'GuessArt Bot'; },

    // Mirrors Connection.createRoom's onCode callback shape for symmetry,
    // even though there's no real room code — app.js's solo-mode caller
    // just uses this to move straight to game start.
    start(onReady) {
      connected = true;
      setTimeout(() => onReady && onReady(), 300);
    },

    // Called by app.js exactly where it would call Connection.send().
    send(data) {
      switch (data.type) {
        case 'hello':
          // Human said hello — bot replies with its own hello so
          // app.js's friendName wiring works unchanged.
          emit({ type: 'hello', name: botName });
          break;
        case 'start_turn':
        case 'next_turn': {
          // Both mean the same thing to the bot: "here's whose turn it
          // is now, from the human's perspective — flip it for us."
          // 'start_turn' only ever fires once, at game start; every
          // later turn switch (round 2 onward) arrives as 'next_turn'
          // instead (see advanceTurn()/showRoundResult() in app.js) —
          // treating them identically here is what makes the bot
          // actually take its turn on every round, not just the first.
          botIsDrawer = !data.drawerIsMe;
          clearTimers();
          if (botIsDrawer) {
            secretWord = getRandomWordForBot();
            startBotDrawing(secretWord);
          } else {
            startBotGuessing();
          }
          break;
        }
        case 'chat':
          // Human typed a guess/chat message — if bot is drawing, check it.
          if (botIsDrawer && secretWord && !roundOver) {
            const norm = t => t.trim().toLowerCase().replace(/\s+/g, '');
            if (norm(data.text) === norm(secretWord)) {
              roundOver = true;
              clearTimeout(roundTimeoutTimer);
              emit({ type: 'correct_guess', word: secretWord });
            }
          }
          break;
        case 'clear':
        case 'stroke':
        case 'fill':
        case 'undo':
        case 'seen':
        case 'voiceline':
        case 'rename':
          // These are things the HUMAN drawer/guesser does; the bot
          // doesn't need to react to its own drawing surface's sync
          // traffic bouncing back, and has nothing meaningful to do
          // with a rename or voiceline trigger.
          break;
      }
    },

    onMessage(fn) { messageHandlers.push(fn); },
    onOpen(fn) { onOpenHandlers.push(fn); },
    onClose() {},
    onReconnecting() {},
    onReconnected() {},
    onReconnectFailed() {},
    isHost() { return true; }, // solo mode always treats the human as host (turn-order authority)
    isConnected() { return connected; },
    myPeerId() { return 'local-solo'; },
    friendPeerId() { return 'bot'; },
    getRawPeer() { return null; }, // VoiceCall no-ops safely when this is null

    destroy() {
      connected = false;
      clearTimers();
      messageHandlers = [];
      onOpenHandlers = [];
    },
  };
})();

// Bot's own secret word when it's the drawer — shares the SAME excluded-words
// pool the human's Game module is tracking (via Game.getState().usedWords is
// not exposed, so we mirror it independently here) to avoid the bot and the
// human drawing the identical word in different rounds of one session.
let __botUsedWords = [];
function getRandomWordForBot() {
  // Merge in whatever the human has already drawn this game too, so the
  // full 8-round session doesn't repeat a word across BOTH sides.
  const humanUsed = (typeof Game !== 'undefined' && Game.getUsedWords) ? Game.getUsedWords() : [];
  const w = typeof getRandomWord === 'function' ? getRandomWord(__botUsedWords.concat(humanUsed)) : null;
  if (w) __botUsedWords.push(w);
  return w;
}
