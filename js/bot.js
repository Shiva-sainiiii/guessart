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

  // ---- DRAWINGS-format converter (js/drawings.js) ----
  // Converts the tester.html-style {action:"gesture"/"fill", ...} step
  // list into the pacer's beat shape: gestures become one beat with
  // segs+color+width (unbroken polyline, drawn as a single connected
  // stroke — matches how tester.html plays them back); fills become a
  // beat with `fill: {color}` and no segs, which the pacer below turns
  // into an emitted 'fill' network message instead of a stroke.
  function drawingStepsToBeats(steps) {
    return steps.map(step => {
      if (step.action === 'fill') {
        return { fill: true, x: step.x, y: step.y, color: step.color };
      }
      // gesture
      return { segs: polyline(step.points, 1), color: step.color, width: step.width };
    });
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
    // 1. Hand-drawn library from js/drawings.js (tester.html JSON) — most
    //    detailed, colored, recognizable sketches. Checked first.
    if (typeof DRAWINGS !== 'undefined' && DRAWINGS[key]) return drawingStepsToBeats(DRAWINGS[key]);
    // 2. Older hand-coded geometric TEMPLATES.
    if (TEMPLATES[key]) return TEMPLATES[key]();
    // 3. Generic category sketch — always available.
    return genericSketch(key);
  }

  // ---- Guessing brain (fully local — no network calls) ----
  // Tracks what the bot currently knows about the secret word: the
  // letter/space pattern, any letters revealed so far, and every clue
  // sentence it's received. Produces a "thinking" performance: a small,
  // random number of plausible-but-wrong guesses first, then the real
  // answer once the bot has legitimately narrowed the word list down to
  // it via pattern + revealed letters — never by peeking at the actual
  // secret word, which this client never receives (see BotPeer below).

  // WORD_LIST is laid out in fixed category blocks (see js/words.js).
  // These boundary indices mirror that file's section comments, so wrong
  // guesses can be drawn from the SAME category as the true answer once
  // one is known, which reads as far more "thinking" than a random word.
  const CATEGORY_BOUNDS = [
    { name: 'objects', start: 0, end: 30 },
    { name: 'animals', start: 30, end: 63 },
    { name: 'food', start: 63, end: 88 },
    { name: 'nature', start: 88, end: 111 },
    { name: 'actions', start: 111, end: 132 },
    { name: 'fantasy', start: 132, end: 153 },
    { name: 'india', start: 153, end: 999 },
  ];
  function categoryOf(index) {
    const hit = CATEGORY_BOUNDS.find(c => index >= c.start && index < c.end);
    return hit ? hit.name : 'objects';
  }

  const STOPWORDS = new Set(['it', 'its', 'a', 'an', 'the', 'you', 'your', 'is', 'are', 'to', 'in', 'on', 'at', 'of',
    'and', 'or', 'has', 'have', 'with', 'that', 'this', 'they', 'them', 'often', 'usually', 'sometimes',
    'people', 'can', 'used', 'use', 'for', 'like', 'from', 'up', 'down', 'over', 'not', 'be', 'as', 'when',
    'than', 'their', 'were', 'was', 'do', 'does', 'many', 'most', 'some', 'without', 'before', 'after']);

  function makeGuesserState() {
    return {
      pattern: null,          // e.g. "LLLLL"
      revealed: {},           // index -> letter
      clueWords: [],          // keyword pool harvested from clue sentences
      triedGuesses: new Set(),
      plannedWrongCount: null,  // rolled once per round on first tick
      wrongGuessesMade: 0,
      knownAnswer: null,        // set once pattern+letters narrow to exactly 1 candidate
    };
  }

  // All WORD_LIST entries that still fit the current pattern length and
  // every already-revealed letter position. This is legitimate — the
  // bot is only using information it was actually sent over the wire.
  function fittingCandidates(state) {
    if (typeof WORD_LIST === 'undefined' || !state.pattern) return [];
    const patLetters = state.pattern.replace(/\s+/g, '');
    const out = [];
    WORD_LIST.forEach((entry, idx) => {
      const w = entry.word.toLowerCase();
      const norm = w.replace(/\s+/g, '');
      if (norm.length !== patLetters.length) return;
      let ok = true, flatIdx = 0;
      for (let i = 0; i < state.pattern.length; i++) {
        if (state.pattern[i] === ' ') continue;
        if (state.revealed[i] && state.revealed[i].toLowerCase() !== norm[flatIdx]) { ok = false; break; }
        flatIdx++;
      }
      if (ok) out.push({ word: w, index: idx, entry });
    });
    return out;
  }

  // Keyword-overlap score against clues received so far — used only to
  // rank/flavor guesses, never to invent letters the bot wasn't shown.
  function clueScore(entry, clueSet) {
    const candClues = (entry.clues || []).join(' ').toLowerCase().match(/[a-z]+/g) || [];
    let score = 0;
    candClues.forEach(t => { if (clueSet.has(t) && !STOPWORDS.has(t)) score += 1; });
    return score;
  }

  // Picks a believable WRONG guess: prefers the same category as the
  // true answer (once known) or the same category as whatever's
  // currently highest-scoring, same rough word length, never something
  // already tried, and never the true answer itself.
  function pickWrongGuess(state) {
    if (typeof WORD_LIST === 'undefined') return null;
    const clueSet = new Set(state.clueWords);
    const fitting = fittingCandidates(state);

    // Prefer decoys from the same category as the current best-scoring
    // fitting candidate (proxy for "what the bot is leaning toward"),
    // falling back to the whole list if pattern hasn't arrived yet.
    let anchorCategory = null;
    if (fitting.length) {
      let best = null, bestScore = -Infinity;
      fitting.forEach(c => {
        const s = clueScore(c.entry, clueSet);
        if (s > bestScore) { bestScore = s; best = c; }
      });
      if (best) anchorCategory = categoryOf(best.index);
    }

    const pool = WORD_LIST
      .map((entry, idx) => ({ entry, idx }))
      .filter(({ entry, idx }) => {
        const w = entry.word.toLowerCase();
        if (state.triedGuesses.has(w)) return false;
        if (state.knownAnswer && w === state.knownAnswer) return false;
        if (anchorCategory && categoryOf(idx) !== anchorCategory) return false;
        return true;
      });

    const finalPool = pool.length ? pool : WORD_LIST
      .map((entry, idx) => ({ entry, idx }))
      .filter(({ entry }) => !state.triedGuesses.has(entry.word.toLowerCase()));

    if (!finalPool.length) return null;
    const pick = finalPool[Math.floor(Math.random() * finalPool.length)];
    return pick.entry.word.toLowerCase();
  }

  // Decide what (if anything) to say on this guess tick. Returns a
  // string to send, or null to stay quiet — synchronous, instant,
  // no network involved at all.
  function chooseGuessLocal(state) {
    // Roll the "how many wrong guesses before the real one" script once,
    // the first time this round actually has enough signal to act on
    // (no point rolling before word_length even arrives).
    if (state.plannedWrongCount === null && state.pattern) {
      const r = Math.random();
      state.plannedWrongCount = r < 0.40 ? 0 : (r < 0.75 ? 1 : 2);
    }

    const fitting = fittingCandidates(state);
    if (fitting.length === 1) {
      state.knownAnswer = fitting[0].word;
    } else if (fitting.length > 1 && state.clueWords.length) {
      // Pattern narrowed it to a short list but not a single word —
      // once clue text has arrived, break the tie by keyword overlap
      // instead of stalling forever waiting for a unique letter match.
      // Still fully legitimate: only using clues/letters actually sent.
      const clueSet = new Set(state.clueWords);
      let best = null, bestScore = -Infinity;
      fitting.forEach(c => {
        const s = clueScore(c.entry, clueSet);
        if (s > bestScore) { bestScore = s; best = c; }
      });
      if (best && bestScore > 0) state.knownAnswer = best.word;
    }

    // If the bot has legitimately narrowed it to one word AND has
    // already "used up" its planned wrong guesses, commit to the answer.
    if (state.knownAnswer && state.wrongGuessesMade >= (state.plannedWrongCount || 0)) {
      const answer = state.knownAnswer;
      if (!state.triedGuesses.has(answer)) {
        state.triedGuesses.add(answer);
        return answer;
      }
    }

    // Otherwise, if we still owe the script a wrong guess, throw one out
    // — but only once pattern has arrived, so it doesn't fire on turn 0.
    if (state.pattern && state.wrongGuessesMade < (state.plannedWrongCount || 0)) {
      const guess = pickWrongGuess(state);
      if (guess) {
        state.triedGuesses.add(guess);
        state.wrongGuessesMade += 1;
        return guess;
      }
    }

    // Known answer but still "owed" wrong guesses and couldn't find a
    // decoy (small word list edge case) — just answer rather than stall.
    if (state.knownAnswer && !state.triedGuesses.has(state.knownAnswer)) {
      state.triedGuesses.add(state.knownAnswer);
      return state.knownAnswer;
    }

    return null; // nothing to say yet this tick
  }

  return {
    TEMPLATES_AVAILABLE: Object.keys(TEMPLATES),

    // Returns an ordered list of drawing "beats" for the bot-as-drawer to
    // paint out over the round. Each beat is either a stroke
    // {segs, color, width} or a fill {fill:true, x, y, color}. Fully
    // local/synchronous — no network call, no LLM, no cache needed.
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
    // a chat guess, or null to stay quiet this tick. Fully local/instant.
    chooseGuess(state) {
      return chooseGuessLocal(state);
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
  // The drawing plan itself is fetched async (LLM first, template
  // fallback) — everything else (pattern reveal, clue timing, the
  // round timeout) is scheduled immediately so a slow/failed LLM call
  // never delays the parts of the round the human is waiting on.
  function startBotDrawing(word) {
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

    // Build the drawing plan synchronously — fully local now, no network,
    // no LLM, no waiting. drawQueue mixes two item kinds:
    //   { kind: 'stroke', x1,y1,x2,y2, color, width }  — one segment
    //   { kind: 'fill', x, y, color }                  — one flood fill,
    //     always queued as a single atomic item (never split into segs)
    const beats = BotBrain.planDrawing(word);
    if (roundOver || secretWord !== word) return;

    drawQueue = [];
    beats.forEach(beat => {
      if (beat.fill) {
        drawQueue.push({ kind: 'fill', x: beat.x, y: beat.y, color: beat.color });
      } else {
        beat.segs.forEach(seg => {
          drawQueue.push(Object.assign({ kind: 'stroke', color: beat.color, width: beat.width, erase: false }, seg));
        });
      }
    });

    // Drip out strokes/fills over roughly 45 seconds so the sketch builds
    // up progressively instead of appearing all at once.
    const totalMs = 45000;
    const perItem = Math.max(60, totalMs / Math.max(1, drawQueue.length));
    let i = 0;
    function tick() {
      if (i >= drawQueue.length || roundOver) return;
      const item = drawQueue[i];
      if (item.kind === 'fill') {
        emit({ type: 'fill', x: item.x, y: item.y, color: item.color });
      } else {
        emit({ type: 'stroke', x1: item.x1, y1: item.y1, x2: item.x2, y2: item.y2, color: item.color, width: item.width, erase: false });
      }
      i++;
      drawTimer = setTimeout(tick, perItem + (Math.random() * 40 - 20));
    }
    drawTimer = setTimeout(tick, 500);
  }

  // Bot-as-guesser: periodically evaluate whether it has enough signal
  // to take a guess, with human-like variable timing. Fully local and
  // synchronous now — no network call, so this can never 502 or stall.
  // Early ticks are slower (bot is "reading" clues); once it has
  // legitimately narrowed the word down via pattern + revealed letters
  // it still waits out any scripted decoy guesses before committing,
  // which reads as the bot "thinking" rather than insta-solving.
  function startBotGuessing() {
    guesserState = BotBrain.newGuesserState();
    let tickCount = 0;
    function tick() {
      tickCount += 1;
      // First tick waits a bit longer (word_length/first clue need to
      // arrive first); later ticks are a touch snappier.
      const base = tickCount === 1 ? 5000 : 3500;
      const delay = base + Math.random() * 4000;
      guessTimer = setTimeout(() => {
        if (roundOver) return;
        const guess = BotBrain.chooseGuess(guesserState);
        if (roundOver) return;
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
        case 'word_length':
          // Human (drawer) told us the letter/space pattern. This was
          // previously dropped entirely — guesserState.pattern stayed
          // null for the whole round, every round, which meant the
          // guessing engine's pattern-length filtering almost never
          // actually engaged. Feed it into the live guesser state.
          if (!botIsDrawer && guesserState) {
            BotBrain.ingestPattern(guesserState, data.pattern);
          }
          break;
        case 'hint_reveal':
          // Human (drawer) revealed one letter. Same story — this never
          // reached the bot's guesser state before.
          if (!botIsDrawer && guesserState) {
            BotBrain.ingestReveal(guesserState, data.index, data.letter);
          }
          break;
        case 'clue':
          // Human (drawer) sent a rotating text clue.
          if (!botIsDrawer && guesserState) {
            BotBrain.ingestClue(guesserState, data.text);
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
