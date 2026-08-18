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
// Three responsibilities live here:
//   1. BotBrain — the "intelligence": decides what to draw (a list of canvas
//      strokes for a word) and decides what to type as a guess given the
//      hints/clues it has received so far.
//   2. BotChat  — the "voice": decides whether an incoming chat message is
//      actually a word guess (handled by BotBrain, unchanged) or just the
//      human talking ("bhai hara diya na", trash talk, random comments),
//      and if it's the latter, gets a short in-character Hinglish reply —
//      from a local canned pool by default, or from api/bot-chat.js (an
//      OpenRouter-backed serverless function) once OPENROUTER_API_KEY is
//      configured in Vercel. See BotChat.getReply below for the full
//      Phase A (local) / Phase B (API) split.
//   3. BotPeer  — the "network stand-in": has the same shape as Connection
//      (send/onMessage/onOpen/isConnected/destroy...) but instead of going
//      over WebRTC, it just calls BotBrain/BotChat locally and echoes
//      results back through its own message handlers on a short
//      randomized delay (so it doesn't feel like an instant, robotic
//      reflex).

// ---------------------------------------------------------------------
// BotChat — conversational voice for non-guess chat messages
// ---------------------------------------------------------------------
// Kept entirely separate from BotBrain's guessing logic: a message only
// ever reaches BotChat AFTER classifyMessage() below has decided it does
// NOT look like a word-guess attempt, so nothing here can ever interfere
// with actual gameplay scoring/correctness.
const BotChat = (() => {

  // ---- Classification: is this message a guess attempt, or just chat? ----
  // Deliberately simple/local (no API call for this step — it needs to be
  // instant, and it's only ever used to route where the reply comes from,
  // never to judge correctness). A message reads as a GUESS attempt when
  // it's short and shaped like someone trying an answer rather than
  // typing a sentence; everything else is conversational.
  const CONVERSATIONAL_MARKERS = [
    'bhai', 'yaar', 'yrr', 'bro', 'lol', 'lmao', 'haha', 'hehe', 'wtf', 'omg',
    'kya', 'kaise', 'kyun', 'kyu', 'nahi', 'nhi', 'haan', 'han', 'acha', 'achha',
    'hara', 'jeet', 'jeeta', 'harra', 'chal', 'dekh', 'suno', 'are', 'arre',
    'good', 'nice', 'wow', 'noob', 'pro', 'cheat', 'hint', 'help', 'please', 'plz',
  ];

  function classifyMessage(text, currentWordLength) {
    const trimmed = (text || '').trim();
    if (!trimmed) return 'ignore';

    const lower = trimmed.toLowerCase();
    const wordCount = trimmed.split(/\s+/).length;
    const hasQuestionOrExclaim = /[?!]{1,3}$/.test(trimmed);
    const hasConversationalMarker = CONVERSATIONAL_MARKERS.some(m => {
      const re = new RegExp(`(^|\\s)${m}(\\s|$)`, 'i');
      return re.test(lower);
    });

    // Long messages, ones with sentence punctuation, or ones containing an
    // obvious conversational marker word are chat, not guess attempts —
    // regardless of length, since "bhai hara diya na?" would otherwise
    // still be short enough to look guess-shaped.
    if (hasConversationalMarker || hasQuestionOrExclaim || wordCount >= 4) {
      return 'conversational';
    }

    // Very short (1-3 words), no punctuation, no chat markers — reads as
    // a genuine guess attempt (right or wrong doesn't matter here, that's
    // BotBrain's job elsewhere). Optionally cross-check against the
    // current word's letter count when known, as a mild extra signal.
    if (currentWordLength && Math.abs(trimmed.replace(/\s+/g, '').length - currentWordLength) > 6) {
      return 'conversational'; // wildly different length than the secret word — unlikely to be a serious guess
    }
    return 'guess';
  }

  // ---- Phase A: local canned Hinglish replies (no network, always available) ----
  const REPLY_ON_LOSS_TAUNT = [ // human is gloating about winning/the bot losing
    "abhi round baaki hai bhai 😏", "itni jaldi khushi mat mana",
    "dekhte hai agla round kiska hai 👀", "chal chal, luck tha bas",
    "next round me pata chalega 😤", "ek round se kuch nahi hota bhai",
    "wait kr, comeback aa raha hai", "abhi toh game shuru hui hai",
    "luck factor tha bhai, skill nahi", "agli baar dekhna kya hota hai",
    "overconfidence acchi baat nahi hoti 😏", "chal round 2 me milte hai",
    "itna mat uchhal, aur rounds baaki hai", "haar jeet chalti rehti hai bhai",
    "next time revenge lunga 😤", "abhi match khatam nahi hua",
    "tu jeeta but game abhi baaki hai", "chill kr le, aur chance milega",
    "ek jeet se champion nahi bnte", "dekhte hai final score kya aata hai",
    "mai bhi kabhi kabhi soft khelta hu 😌", "warm up round tha bas ye toh",
    "asli khel abhi shuru hoga", "tu lucky tha is baar bhai",
    "score card abhi complete nahi hua", "next round mera hoga dekhna",
    "itni khushi baad me manana", "abhi toh trailer tha, picture baaki hai",
    "mai comeback king hu bhai 😎", "tension mat le, wapas aunga",
    "round ek jeeta, game nahi jeeta", "bas ek chance tha tera",
    "dekh lena agle round me kya hota hai", "khushi jaldi manai tune",
    "abhi bahut kuch baaki hai bhai", "next round easy hoga mere liye",
    "tu overconfident ho raha hai thoda", "chal ab meri baari hai jeetne ki",
    "haar ke bhi seekhta hu mai 😅", "ye toh bas shuruwat thi",
    "final result abhi aana baaki hai", "mujhe underestimate mat kr",
    "aaj ka din tera tha, kal dekhna", "ek match se kuch decide nahi hota",
    "mai wapas strong aunga next round", "bas luck sath tha tere",
    "khel abhi lamba chalna hai", "confidence acha hai par overconfidence nahi",
    "dekhte hai kaun aakhir me haste hai", "round khatam, game nahi",
    "mai bhi kabhi weak day pe hota hu", "next round mera comeback hoga dekhna",
  ];
  const REPLY_ON_WIN_TAUNT = [ // human is complaining the bot is too good / cheating accusation
    "cheat nahi kar raha, bas skill hai 😎", "dimaag laga ke khela bhai",
    "haha nahi yaar, seedha guess tha", "practice kiya hai thoda 😌",
    "cheating ka koi scope hi nahi hai isme", "bas dhyan se dekha aur bol diya",
    "mai genuinely smart hu bhai 😏", "koi trick nahi, seedha logic tha",
    "tere clues hi itne clear the", "mehnat rang laayi bas",
    "mai bhi kabhi kabhi sahi guess kr leta hu", "isme cheat krna possible hi nahi",
    "bas observation skills acchi hai meri", "practice makes perfect bhai",
    "tune khud hi easy bana diya tha", "mai concentration se khelta hu",
    "koi shortcut nahi liya maine", "seedha dimaag lagaya bas",
    "tere hints hi kaafi the samajhne ko", "skill hai bhai, maano ya na maano",
    "mai fair khelta hu hamesha", "bas thoda experience hai isme",
    "tune bhi acha draw kiya tha, easy ho gya", "genuine guess tha bhai believe kr",
    "mai bhi surprised hu apne aap se 😅", "logic lagaya seedha seedha",
    "cheat krne ki zarurat hi nahi padi", "clean game khela maine",
    "tere pattern se pata chal gya tha", "bas dimaag thoda tez chal gya",
    "mai hamesha honestly khelta hu", "koi hack nahi use kiya bhai",
    "tune hi itna clear draw kiya tha", "practice se sab possible hai",
    "mai bhi kabhi lucky guess kr leta hu", "seedha samajh aa gya bas",
    "no cheating, only observation", "mera dimaag tez chalta hai bas isliye",
    "tere drawing style se samajh gya tha", "fair and square jeeta maine",
    "bas focus kiya thoda zyada", "mai bhi kabhi genius mode me hota hu 😌",
  ];
  const REPLY_ON_HINT_REQUEST = [ // human is asking for a hint
    "nahi bhai, khud soch 😏", "hint maangna mana hai yaha 🙅",
    "thoda dimaag laga na yrr", "clue toh already de raha hu, aur nahi milega",
    "khud try kr bhai, maza aayega", "hint nahi milega, khud soch",
    "already kaafi clues de diye hai", "thoda aur dhyan se dekh, mil jayega",
    "nahi yrr, khud figure out kr", "extra hint ka rule nahi hai",
    "jo mila hai usi se kaam chala", "thoda patience rakh bhai",
    "sochne ka maza hi alag hai", "hint dena cheating jaisa lagta hai",
    "nahi bhai, apna dimaag use kr", "already bahut clear kr diya hai",
    "thoda zyada try kr, aa jayega", "hint system already on hai bhai",
    "khud dhyan se dekh drawing ko", "nahi milega extra help",
    "jitna diya hai utna kaafi hai", "thoda challenge bhi hona chahiye na",
    "sochna bhi toh game ka part hai", "hint maangna easy mode hai bhai 😏",
    "nahi yrr, khud struggle kr thoda", "already itna diya hai, aur nahi",
    "khud ki skills use kr bhai", "thoda mehnat kr guess krne ki",
    "hint free me nahi milta yaha", "socho socho, aa jayega jaldi",
    "nahi bhai rules rules hote hai", "thoda aur observe kr drawing ko",
    "khud kr, mai sirf clue de sakta hu", "already maximum clue de chuka hu",
    "thoda dimaag pe zor daal", "nahi milega, ye tera challenge hai",
    "hint mangna weak move hai bhai 😂", "khud socho, smart ho tum log",
    "already fair chance diya hai", "nahi bhai, iska maza khud lo",
    "thoda aur koshish kr le pehle",
  ];
  const REPLY_GENERIC = [ // fallback for anything else conversational
    "haha theek hai bhai 😂", "acha acha", "sahi hai yrr",
    "chal aage badhte hai", "😂😂", "hmm sahi baat",
    "waise tu khelta accha hai", "ye game maza aa raha hai na",
    "bilkul sahi bola", "haha true hai", "acha point hai ye",
    "chalo aage dekhte hai", "sahi ja rha hai sab", "😄😄",
    "waaah nice", "mai bhi yehi soch raha tha", "haan bilkul",
    "chal maza aa raha hai game me", "sahi hai bhai, continue kr",
    "hmm interesting", "😂 sahi bola", "acha socha tune",
    "waise game acha chal raha hai", "chalo dekhte hai age kya hota",
    "haha bilkul sahi", "sahi observation hai", "mast baat kahi",
    "chal age badhte hai jaldi", "😅 sahi hai yaar", "acha laga sun ke",
    "haan mujhe bhi lgta hai", "chalo next round dekhte hai",
    "sahi hai, maza aa raha", "waise tera game sense acha hai",
    "😂 haan bilkul", "chal thoda aur khelte hai", "sahi baat hai bhai",
    "acha hi chal raha hai sab", "haha same feeling", "mast game hai ye",
    "sahi hai, enjoy kr rha hu mai", "chalo dekhte hai kya hota hai age",
    "waaah mast", "haan sach me", "acha laga ye sunke",
    "chal aage ka round dekhte hai", "sahi ja rha hai bhai sab kuch",
    "😄 bilkul sahi", "waise maza aa raha hai khelke",
    "acha hi hai sab kuch", "haan bilkul agree", "chalo continue krte hai",
    "sahi hai yrr, mast chal rha", "😂 haha sach hai",
    "acha socha hai tune ye", "chal dekhte hai final result",
    "waise game kaafi maza aa raha", "sahi baat bol di tune",
    "haan wahi toh 😄", "chal aage badhte hai fatafat",
    "acha lgta hai aisa sunke", "sahi hai, khelte rehte hai",
    "😅 haan bilkul sahi", "mast point tha ye",
    "chalo age dekhte hai kya hota", "waise sahi hi keh raha hai tu",
    "haan mai bhi enjoy kr raha hu", "acha chal raha hai game overall",
    "sahi hai bhai, continue rakh", "haha bilkul waisa hi",
    "chal age ka round shuru krte hai", "mast baat bol di",
    "waise mast game hai ye genuinely", "haan sahi soch hai teri",
    "😄 acha laga", "chalo dekhte hai kaun jeetega aakhir me",
  ];

  function localReply(text) {
    const lower = (text || '').toLowerCase();
    if (/\b(hara|haar|lose|lost|jeet|jeeta|won|win)\b/.test(lower)) {
      return REPLY_ON_LOSS_TAUNT[Math.floor(Math.random() * REPLY_ON_LOSS_TAUNT.length)];
    }
    if (/\b(cheat|kaise pata|how do you know|dimaag)\b/.test(lower)) {
      return REPLY_ON_WIN_TAUNT[Math.floor(Math.random() * REPLY_ON_WIN_TAUNT.length)];
    }
    if (/\b(hint|clue|bata de|batade|help)\b/.test(lower)) {
      return REPLY_ON_HINT_REQUEST[Math.floor(Math.random() * REPLY_ON_HINT_REQUEST.length)];
    }
    return REPLY_GENERIC[Math.floor(Math.random() * REPLY_GENERIC.length)];
  }

  // ---- Phase B: AI-backed reply via api/bot-chat.js (OpenRouter) ----
  // Always tried first when fetch is available (browser environment);
  // falls back to localReply() the moment anything goes wrong — timeout,
  // network error, non-2xx, or the endpoint reporting stub mode (no
  // OPENROUTER_API_KEY configured yet, see api/bot-chat.js's comment
  // header). The caller never has to know which path actually served
  // the reply; getReply always resolves to a usable string.
  async function apiReply(text, botIsDrawer, roundContext) {
    if (typeof fetch !== 'function') return null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch('/api/bot-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, botIsDrawer, roundContext }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return null;
      const data = await res.json();
      return (data && data.reply) ? String(data.reply) : null;
    } catch (err) {
      return null; // network error, timeout, endpoint not deployed yet, etc — silently fall through to local reply
    }
  }

  return {
    // Returns 'guess' | 'conversational' | 'ignore'. Only 'conversational'
    // messages should ever be routed to getReply below — a 'guess' stays
    // entirely on BotBrain's existing exact-match path in BotPeer.send's
    // 'chat' case, and 'ignore' (empty message) gets no reply at all.
    classifyMessage,

    // Resolves to a reply STRING (never null/empty) — tries the AI
    // endpoint first, falls back to a local canned line so the bot always
    // has something to say once classifyMessage has decided a reply is
    // warranted.
    async getReply(text, botIsDrawer, roundContext) {
      const fromApi = await apiReply(text, botIsDrawer, roundContext);
      return fromApi || localReply(text);
    },
  };
})();

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
  //
  // SAFETY NET for "fill leaks across the whole canvas": a flood fill's
  // start point needs to sit inside a genuinely CLOSED outline, or the
  // paint has nowhere to stop and spreads everywhere. js/drawings.js is
  // hand-authored (drawn by hand in tester.html), and it's easy to leave
  // an outline's start/end points a few pixels apart, or even
  // deliberately unfinished, without noticing — the gap is often
  // invisible at drawing time but is exactly what a flood fill exploits.
  // Rather than hand-auditing every entry (and re-auditing every new one
  // added later), this converter inserts one extra invisible-ish closing
  // segment — same color as the gesture, drawn right along with it —
  // connecting the outline's actual last point back to its first point
  // whenever they aren't already touching. That segment becomes part of
  // the SAME beat (so it renders as if it were always part of the
  // outline), guaranteeing every fill's containing shape is closed
  // before the fill beat ever runs, without changing how any correctly-
  // closed drawing looks.
  function drawingStepsToBeats(steps) {
    const beats = [];
    let lastGestureBeat = null; // the most recent gesture beat, so a following fill can check/fix its closure
    let lastGesturePts = null;

    steps.forEach(step => {
      if (step.action === 'fill') {
        // About to fill relative to whatever gesture was drawn last —
        // make sure that gesture's outline is actually closed first.
        if (lastGestureBeat && lastGesturePts && lastGesturePts.length >= 3) {
          const first = lastGesturePts[0];
          const last = lastGesturePts[lastGesturePts.length - 1];
          const gapSq = (first[0] - last[0]) ** 2 + (first[1] - last[1]) ** 2;
          if (gapSq > 0.0004) { // > ~2% of canvas width apart — a real gap, not just float noise
            lastGestureBeat.segs.push({ x1: last[0], y1: last[1], x2: first[0], y2: first[1] });
          }
        }
        beats.push({ fill: true, x: step.x, y: step.y, color: step.color });
      } else {
        // gesture
        const beat = { segs: polyline(step.points, 1), color: step.color, width: step.width };
        beats.push(beat);
        lastGestureBeat = beat;
        lastGesturePts = step.points;
      }
    });
    return beats;
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
    { name: 'animals', start: 30, end: 54 },
    { name: 'food', start: 54, end: 78 },
    { name: 'nature', start: 78, end: 99 },
    { name: 'actions', start: 99, end: 118 },
    { name: 'fantasy', start: 118, end: 137 },
    { name: 'india', start: 137, end: 999 },
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
  // How many of secretWord's clues have actually been sent to the
  // guesser via the real { type: 'clue' } messages so far this round
  // (see startBotDrawing's clue-scheduling below, which increments
  // this each time one fires). clueBasedBanterLine() only ever draws
  // from clues[0..cluesRevealedCount-1] — i.e. things the guesser has
  // ALREADY legitimately been told — so smart banter can never spoil a
  // clue earlier than the real clue system would have revealed it.
  let cluesRevealedCount = 0;
  // True once the human (drawer) has actually put at least one stroke on
  // the canvas this round. The bot's guess-timer loop checks this before
  // ever speaking — guessing before a single line exists would feel
  // unfair/psychic, no matter how "wrong" the early guesses are scripted
  // to be. Reset every turn in clearTimers().
  let humanHasStartedDrawing = false;
  // Count of strokes seen this round, purely to time reaction banter
  // ("bhai ye kya bana diya 😭" etc.) a little into the drawing rather
  // than on the very first pen-down, and to avoid firing banter more
  // than once every few strokes.
  let strokeCountThisRound = 0;
  let banterFiredThisRound = 0;
  let banterTimer = null;
  const MAX_BANTER_PER_ROUND = 2;

  const ROUND_SECONDS = 70; // must match Game's ROUND_SECONDS (js/game.js) so bot-as-drawer timeouts land at the same moment the human's own timer UI hits 0

  // ---- Human-like chat banter ----
  // Casual Hinglish one-liners + emoji-only reactions the bot fires
  // occasionally, interleaved with its real/decoy guesses (when it's the
  // guesser) or just as ambient chatter (when it's the drawer), so the
  // chat log reads like a friend messing around rather than a program
  // printing candidate words. These never affect chooseGuess's logic —
  // purely cosmetic flavor sent as ordinary 'chat' messages.
  //
  // TWO SEPARATE POOLS, chosen by who's actually drawing this round:
  //   GUESSER_BANTER_LINES — said when the HUMAN is drawing and the bot
  //     is watching/guessing ("bhai thoda aur try kr le", "kuch samajh
  //     nahi aa rha" etc.) — these are reactions to someone else's
  //     drawing, so they only make sense pointed at the human.
  //   DRAWER_BANTER_LINES — said when the BOT ITSELF is drawing and the
  //     human is guessing ("bata bhi de yrr", "itna easy hai ye" etc.)
  //     — these are the bot hyping/teasing about its OWN sketch, the
  //     opposite direction. Mixing the two pools (the old bug) meant the
  //     bot could tell itself "bhai thoda aur try kr le" about its own
  //     drawing, which reads as broken/confusing rather than human.
  const GUESSER_BANTER_LINES = [
    'bhai tera baseka nahi hai ye 😭',
    'yrr itni kharab drawing 😂',
    'ye kya bana diya bhai',
    'bhai thoda aur try kr le',
    'kuch samajh nahi aa rha 🤔',
    'are wah, thoda thoda samajh aa rha h',
    'okay okay ab dikh rha kuch kuch',
    'bhai ye toh mast bana rha h tu',
    'waah kya drawing bnai hai bhai 🔥',
    'lgta h pehli baar draw kr rha h 😅',
    'ruk zra... sochne de',
    'hmm interesting shape hai ye',
    'bhai hint bhi dede yrr 👀',
    'itna time lg rha, jaldi bana',
    'ye line ka kya matlab tha bhai 😭',
    'arre ye toh bilkul alag cheez lg rha',
    'sahi ja rha hai ab thoda thoda',
    'bhai haath kaanp rha kya tera 😂',
    'ek dum abstract art bana diya',
    'mujhe lg rha mujhe pata hai ye kya hai',
    'nahi nahi galat soch rha tha mai',
    'bhai itna zoom kr k kyu bana rha',
    'chhota sa hint bhi chalega yrr',
    'tu Picasso ban gya kya aaj 😅',
    'thoda aur detail dal de bhai',
    'ye shape dekh k kuch bhi lg skta hai',
    'wait wait, mujhe kuch dikh rha',
    'nope, phir se confuse ho gya',
    'bhai speed thodi badha de',
    'itni der me toh main sketch bana deta',
    'accha ye us type ka kuch hai kya',
    'bhai seedha bata de na yrr 🙏',
    'kya baat hai, professional lg rha',
    'thoda sa aur clear kr de',
    'mera dimaag ghoom gya isse dekh k',
    'ye toh alien language lg rha 😭',
    'chal koi na, dekhte hai age kya banta h',
    'bhai colour bhi daal de thoda',
    'ye curve wala part interesting hai',
    'tu serious mai bana raha hai na ye 😂',
    'thoda size bada kr de bhai',
    'kuch toh sense bann raha hai ab',
    'aacha wait, ye kuch aur lg rha ab',
    'bhai tension mat le, guess kr lunga',
    'itni jaldi mat bana, dekhne de',
    'lgta hai tu practice krke aya hai aaj',
    'nice nice, chal aage kya hai',
    'ye edge wala part samajh nahi aaya',
    'ekdum smooth chal rha hai tera hath',
    'bhai zyada mat soch, seedha bana',
    'ye kaunsi category ka lg rha hai',
    'thoda outline clear kr de yrr',
    'main dekh k hi bata dunga wait kr',
    'kya cheez hai ye bhai genuinely confuse hu',
    'ye definitely kuch round shape hai',
    'sahi jaa raha hai keep going',
    'bhai jaldi kr varna time khatam ho jayega',
    'thoda aur patience rakhna padega mujhe',
    'accha ab kuch samajh aana shuru hua',
    'itna abstract kyu bana rha bhai 😭',
    'lgta hai koi object hai ye normal sa',
    'wah kya lines khinch raha hai tu',
    'mujhe laga tha kuch aur hoga ye',
    'bhai itni detail ki zarurat nahi thi',
    'chill mode me bana rha hai lgta h',
    'ye toh mystery bnn gyi ab',
    'thoda tez hath chala bhai',
    'ye definitely animal jaisa lg rha',
    'nahi ye toh khaane ki cheez lg rhi',
    'bhai concentration full on hai tera',
    'ye left wala part kya hai bhai',
    'thoda round round sa hai ye',
    'lagta hai koi vehicle hai shayad',
    'nahi nahi ye toh nature se related lg rha',
    'bhai itne colours mat bhar, confuse ho rha',
    'wait, ab pura structure dikh gya',
    'ye toh ekdum unique style hai tera',
    'kya baat, kaafi neat bana hai',
    'bhai edges thoda sharp kr',
    'lgta hai tune practice ki hai isme',
    'ye toh bahut hi random lg rha abhi',
    'sochne do bhai, dimaag chal rha hai',
    'kaafi der ho gyi ab toh bata de kuch',
    'ye sab lines ka kya connection hai',
    'bhai symmetry acchi hai tere drawing me',
    'mujhe ek shape dikh rha bas',
    'thoda outline se bahar mat ja',
    'ye toh puzzle bann gya poora',
    'accha ab dhire dhire samajh aa rha',
    'kaafi patience chahiye is drawing ko samajhne me',
    'bhai itna precise mat bana, time bach',
    'ye kuch electronic cheez lg rhi kya',
    'nahi lgta food item hi hai koi',
    'bhai teri drawing me kaafi soul hai 😂',
    'ek second, kuch dikh raha hai mujhe',
    'thoda zyada bada bana de bhai',
    'ye toh minimal art lg rha',
    'kaafi confusing angles hai isme',
    'bhai seedhe seedhe lines bhi kaam krte',
    'ye definitely kuch use hone wali cheez hai',
    'mujhe laga tha easy hoga ye round',
    'thoda sa aur wait krte hai',
    'bhai itni jaldi mat kr, dekh k bata',
    'ye shape kaafi complex lg rhi mujhe',
    'lagta hai kisi jaanwar ka hissa hai',
    'kya ye kisi cheez ka top view hai',
    'bhai itna talent tha pata nahi tha 😅',
    'ye pura scene bann gya kaafi kuch',
    'thoda perspective samajh nahi aa rha',
    'chalo dekhte hai final result kya hoga',
    'bhai ye toh bilkul naya style hai tera',
    'itni jaldi mat kar, poora dekhne de',
    'lagta hai koi sports se related hai',
    'ye toh kaafi geometric lg rha',
    'bhai brush stroke acche hai tere 😂',
    'kuch toh clue mil raha hai ab',
    'itna pichla wala part samajh nahi aaya',
    'ye definitely kisi cheez ka outline hai',
    'thoda sa aur wait krna padega mujhe',
    'bhai ye toh horror movie jaisa lg rha 😭',
    'accha ab structure clear ho rha',
    'ye kaafi creative angle hai bhai',
    'lagta hai tu serious artist hai andar se',
    'thoda sa hint aur chahiye tha',
    'ye upar wala hissa kya hai bhai',
    'sochne ka time zyada lg raha mujhe',
    'kaafi mast texture diya hai isme',
    'ye toh kisi transport ka part lg rha',
    'bhai line thodi wobbly hai par chalega',
    'ab dhire dhire cheez samajh aa rahi',
    'ye definitely kuch daily use ki cheez hai',
    'thoda area bada kr, chhota lg rha',
    'bhai kaafi der se yehi soch rha hu',
    'ye toh building jaisi shape hai kya',
    'lagta hai koi symbol bana raha hai tu',
    'thoda proportion sahi kr le bhai',
    'ye kaafi minimal but effective hai',
    'bhai teri drawing style unique hai',
    'ab final guess ki taraf badh raha hu',
  ];

  const DRAWER_BANTER_LINES = [
    // Said WHILE the bot itself is drawing and the human is guessing —
    // the bot hyping/teasing about its own sketch, never addressed as
    // if someone else drew it.
    'bhai ye easy hai, jaldi bata de',
    'meri drawing itni buri bhi nahi hai 😤',
    'dekh dekh, kaisi bana rha hu',
    'itna tough nahi hai ye yrr',
    'jaldi guess kr, time nikal ja rha',
    'mai apni taraf se best de rha hu 😅',
    'itna easy hint bhi de diya, phir bhi nahi?',
    'chal soch soch, aa jayega dimaag me',
    'meri art skills dekh zra 🎨',
    'bata de na bhai, kitna time lagayega',
    'ye toh bacchon wala level hai',
    'thoda dhyan se dekh poori drawing',
    'main first try me guess kr leta ye',
    'clue bhi diya, ab toh bata de',
    'lgta hai tujhe practice chahiye guessing ki 😂',
    'mast bana rha hu na? 😎',
    'itna simple bhi nahi samajh aa rha kya',
    'ek dum perfect bana diya maine',
    'jaldi bol, warna time khatam',
    'mujhe khud pe proud feel ho rha is drawing pe',
    'thoda letters bhi dekh liya kr',
    'kya soch rha hai itni der se',
    'mera hath toh mast chal rha hai aaj',
    'itni clarity ke baad bhi confusion?',
    'bhai ye toh common cheez hai ghar ki',
    'sochne ka time khatam hone wala hai',
    'main khud impressed hu apni drawing se',
    'zyada mat soch, jo dikh rha wahi bol de',
    'dekh letters bhi match kr',
    'itna easy bana diya phir bhi miss?',
    'ab toh clue bhi bekar lg rha tujhe',
    'meri drawing skill level up ho gyi lgta h',
    'chal fatafat bata, next round bhi krna hai',
    'itni simple shape hai bhai ye',
    'thoda confidence se bol de jo lg rha',
    'guess krne me time kyu lg rha itna',
    'mai already 2 clues de chuka hu',
    'ye toh roz dikhne wali cheez hai',
    'jaldi bata warna main hi bol dunga 😏',
    'kaafi acha effort tha mera isme',
    'lgta hai aaj tu slow mode me hai',
    'dekh word length bhi match kr raha hai',
    'bilkul sahi track pe hai bas bol de',
    'itna easy diya phir bhi struggle?',
    'mai serious mood me draw kr rha tha',
    'chal ab final answer bata de',
    'mera design sense dekh zra 😌',
    'itni der ho gyi soch soch ke',
    'clue clear tha na bhai?',
    'bas thoda aur socho aa jayega',
    'kaafi karib hai tu answer ke',
    'mujhe laga tujhe pehli baar me hi aa jayega',
    'ab toh letters bhi dikh gaye hai',
    'thoda tez soch bhai time nikal ja rha',
    'meri painting skills underrated hai 😤',
    'ye toh bahut common word hai yaar',
    'aur kitna time chahiye tujhe',
    'dekh ke bhi nahi samajh aa rha?',
    'mai bhi kabhi kabhi acha bana leta hu',
    'bhai final call, kya lg rha hai',
    'itni detail dene ke baad bhi?',
    'chal ek aur chance deta hu sochne ka',
    'ye drawing museum level hai bhai 😂',
    'kaafi close aa gya hai tu shayad',
    'jaldi bol na, suspense mat rakh',
    'mai khud excited hu tera answer sunne ko',
    'itna asaan bana ke bhi tension?',
    'thoda shape pe dhyan de poori tarah',
    'time kam hai bhai, jaldi bata',
    'ye toh ekdum seedha simple hai',
    'meri drawing dekh k confidence badhna chahiye tha',
    'itna clean bana ke bhi guess nahi ho rha',
    'kaafi der se soch rha hai tu',
    'ye toh har koi jaanta hai bhai',
    'thoda si tension le le ab 😏',
    'mera confidence high hai is drawing pe',
    'bas last mein bata dena warna khud bol dunga',
    'itna easy clue diya, ab toh seedha hai',
    'chal jaldi bata, next word bhi ready hai',
    'meri drawing dekh k kuch toh strike krna chahiye',
    'itna time le raha hai, sochne ka full use kr le',
    'ye common si cheez hai ghar ki',
    'thoda letters milake dekh',
    'bhai kaafi acha guess ban skta hai isse',
    'main khud bhi apni drawing pe khush hu',
    'jaldi kr bhai, points miss ho jayenge',
    'ye simple si shape hai dekh dhyan se',
    'itna clue ke baad bhi nahi?',
    'chal ek aur try kr le',
    'meri drawing itni bhi complex nahi hai',
    'time nikal ja raha hai bhai jaldi bol',
    'ye toh super easy category hai',
    'thoda confidence dikha guess me',
    'itni detail dene ke baad bhi confuse?',
    'chal dekhte hai tu sahi bolta hai ya nahi',
    'meri painting mast lg rahi hai khud ko',
    'jaldi se final answer de de',
    'ye cheez roz use hoti hai shayad',
    'thoda soch, letters bhi dekh liye',
    'bhai mai overconfident nahi hu, sach me easy hai',
    'meri drawing me kaafi mehnat hai bhai',
    'jaldi bata, agla round bhi maza ayega',
    'ye normal si roz ki cheez hai',
    'thoda dhyan se colours dekh',
    'itna easy hone ke baad bhi delay?',
    'mai apna best de raha hu isme',
    'chal ab seedha answer bol de',
    'bhai kaafi acha structure bana hai isme',
    'itni jaldi haar mat maan',
    'mera art thoda underrated hai lgta h 😤',
    'jaldi bol, points wait kr rahe',
    'ye toh super common cheez hai',
    'thoda relax kr, aa jayega dimaag me',
    'meri drawing itni bhi tricky nahi thi',
    'chal jaldi kr, time bhaag raha hai',
    'ye ekdum daily life ki cheez hai',
    'bhai itna soch kyu rha, seedha bol',
    'mujhe laga tujhe pehli nazar me aa jayega',
    'thoda aur dhyan se dekh sab kuch',
    'ye clue final tha, ab bata de',
    'kaafi kuch reveal kr diya maine',
    'chal ab full confidence se bol',
    'itna acha bana ke bhi struggle horha',
    'mera hath thoda shaky tha par sahi bana',
    'ye toh bacchon ko bhi pata hoga',
    'thoda size compare kr apne dimaag se',
    'jaldi bol bhai, time out hone wala',
    'ye common object hai bilkul',
    'mera design thoda modern hai isbar',
  ];
  const BANTER_EMOJIS = [
    '😂', '🤔', '👀', '😭', '🔥', '😅', '🙌', '💀', '🤨',
    '😌', '😎', '🎨', '🙏', '😏', '👏', '🤯', '😵‍💫', '🫠',
    '👌', '🥲', '😬', '🤞', '👍', '🧐', '😤', '🫡',
  ];

  // ---- Smart, clue-aware drawer banter ----
  // When the BOT is the drawer, it already knows exactly what it's
  // drawing (secretWord) and already has that word's 2-3 hand-written
  // clue sentences (js/words.js, the same ones ClueSystem cycles to the
  // guesser as { type: 'clue' } messages). Previously the drawer-side
  // banter pool (DRAWER_BANTER_LINES above) was 100% generic ("bhai ye
  // easy hai, jaldi bata de") regardless of whether the bot was drawing
  // an apple or a bicycle — it never actually referenced what was on
  // the canvas. This wraps the SAME clue sentences already being sent
  // through the real clue system in a casual Hinglish chat frame, so
  // the bot's banter reads like a friend dropping an aside about their
  // OWN drawing ("are pata hai... You sit on it." -> feels like real
  // in-character commentary) instead of a disconnected generic line.
  //
  // Deliberately reuses the exact clue text rather than inventing new
  // facts about the word — the clue list is the single source of truth
  // for "things safe to reveal about this word without saying the word
  // itself" (hand-audited to never contain the word), so wrapping it is
  // the only way to guarantee the smart banter never accidentally leaks
  // something the clue author didn't intend to reveal yet.
  const CLUE_WRAP_TEMPLATES = [
    text => `are pata hai... ${text}`,
    text => `ek chhota sa hint: ${text}`,
    text => `waise batau, ${lowerFirst(text)}`,
    text => `${text} samajh me aaya kuch?`,
    text => `free hint: ${text}`,
    text => `arre haan, ${lowerFirst(text)}`,
    text => `ek baat batau... ${lowerFirst(text)}`,
    text => `${text} isse kuch idea mila?`,
    text => `by the way, ${lowerFirst(text)}`,
    text => `dhyan se sun: ${text}`,
    text => `ye bhi try kr: ${lowerFirst(text)}`,
    text => `${text} bas itna hi bata sakta hu`,
    text => `soch soch... ${lowerFirst(text)}`,
    text => `ek aur cheez, ${lowerFirst(text)}`,
    text => `${text} kaafi bada hint hai ye`,
  ];

  function lowerFirst(text) {
    if (!text) return text;
    return text.charAt(0).toLowerCase() + text.slice(1);
  }

  // Returns a clue-derived banter line for the CURRENT secretWord, or
  // null if there's nothing safe to use yet (guesser side, a word with
  // no clue list, or no clue has actually been revealed to the guesser
  // yet this round). Only ever called with botIsDrawer === true — see
  // randomBanterText below — so this never runs on the guesser side,
  // where the bot legitimately doesn't know the word and must not
  // appear to. Restricted to clues[0..cluesRevealedCount-1] so smart
  // banter can only reference something the guesser has ALREADY been
  // told via the real clue system — never a spoiler ahead of schedule.
  function clueBasedBanterLine() {
    if (!secretWord || cluesRevealedCount <= 0) return null;
    const clues = (typeof getCluesForWord === 'function' ? getCluesForWord(secretWord) : []) || [];
    const revealed = clues.slice(0, cluesRevealedCount);
    if (revealed.length === 0) return null;
    const clue = revealed[Math.floor(Math.random() * revealed.length)];
    const wrap = CLUE_WRAP_TEMPLATES[Math.floor(Math.random() * CLUE_WRAP_TEMPLATES.length)];
    return wrap(clue);
  }

  function randomBanterText(botIsDrawerNow) {
    // Occasionally fire an emoji-only reaction instead of a full line,
    // same as how people actually chat — works the same regardless of
    // which pool the full-line branch below draws from.
    if (Math.random() < 0.35) {
      return BANTER_EMOJIS[Math.floor(Math.random() * BANTER_EMOJIS.length)];
    }
    // When the bot is drawing, lean toward clue-aware lines most of the
    // time (feels like the bot is actually commenting on ITS OWN
    // drawing — "ye khane ki cheez hai" while sketching an apple —
    // rather than generic filler that could apply to any word). Still
    // mix in the generic DRAWER_BANTER_LINES some of the time so it
    // doesn't feel like every single message is a hint dump; and always
    // fall back to generic if there's no clue available (e.g. a custom
    // word with an empty clue list).
    if (botIsDrawerNow) {
      if (Math.random() < 0.65) {
        const clueLine = clueBasedBanterLine();
        if (clueLine) return clueLine;
      }
      return DRAWER_BANTER_LINES[Math.floor(Math.random() * DRAWER_BANTER_LINES.length)];
    }
    return GUESSER_BANTER_LINES[Math.floor(Math.random() * GUESSER_BANTER_LINES.length)];
  }

  // Called on its own independent schedule (see startBanterLoop below),
  // completely decoupled from the guess-tick loop. Previously this only
  // ran from inside the guesser's tick() in the branch where
  // chooseGuess() returned nothing to say — which is rare, since
  // chooseGuessLocal almost always has EITHER a real answer or a
  // scripted decoy ready once the pattern has arrived, so in practice
  // banter almost never got a turn to fire. Banter now runs on its own
  // timer regardless of whether a guess also fires that tick, and fires
  // for the bot-as-DRAWER side too (previously banter only existed on
  // the guesser side at all) — using DRAWER_BANTER_LINES rather than
  // reusing the guesser's pool, so the bot never addresses banter meant
  // for a human's drawing at its own sketch (or vice versa).
  function maybeSendBanter() {
    if (roundOver) return;
    if (!botIsDrawer && !humanHasStartedDrawing) return; // same fairness rule as real guesses: don't chat like it's watching a drawing that doesn't exist yet
    if (banterFiredThisRound >= MAX_BANTER_PER_ROUND) return;
    banterFiredThisRound += 1;
    emitChat(randomBanterText(botIsDrawer));
  }

  // Independent banter timer: reschedules itself on a random 8-18s
  // cadence for as long as the round is active, regardless of whatever
  // the guess-tick (or the drawing pacer) is doing. Started once per
  // turn from both startBotDrawing() and startBotGuessing(); stopped by
  // clearTimers() clearing banterTimer at the next turn boundary.
  function startBanterLoop() {
    function tick() {
      const delay = 8000 + Math.random() * 10000;
      banterTimer = setTimeout(() => {
        if (roundOver) return;
        maybeSendBanter();
        tick();
      }, delay);
    }
    tick();
  }

  function emit(data) {
    // Simulate real network latency so bot messages don't feel instant/
    // robotic — EXCEPT for individual drawing strokes/fills. Those are
    // already paced out one-by-one by startBotDrawing()'s own tick()
    // loop (perItem, computed to spread the whole sketch across ~45s),
    // so stacking an extra 250-650ms randomized "network" delay on TOP
    // of every single stroke was compounding with that pacing and made
    // the sketch visibly crawl — a word with ~20-30 stroke segments
    // could take 2-3x longer to finish appearing than intended, often
    // eating into/past the 70s round timer before the drawing was even
    // done. Strokes/fills still get a small fixed jitter so they don't
    // feel like they're teleporting in, but nowhere near the delay a
    // one-off chat message or a hint reveal gets.
    const isDrawingItem = data.type === 'stroke' || data.type === 'fill';
    const delay = isDrawingItem ? (15 + Math.random() * 25) : (250 + Math.random() * 400);
    setTimeout(() => {
      messageHandlers.forEach(fn => fn(data));
    }, delay);
  }

  // ---- Typing indicator lifecycle ----
  // The "…is typing" bubble needs to cover a chat reply's ENTIRE
  // compose time, not just a short fixed tail-delay right before
  // sending — a scripted decoy guess's random wait, and critically
  // BotChat.getReply()'s real network round trip to the OpenRouter API
  // (can legitimately take 1-5 real seconds), both happen BEFORE the
  // reply text is ready. Showing the bubble only after that point (the
  // original, simpler design) meant a fast local canned reply looked
  // like it had "no typing effect" at all (the bubble flashed too
  // briefly around an already-decided message) while a slow API reply
  // felt disconnected from the bubble entirely.
  //
  //   acquireSpeakerLock() — call the MOMENT the bot decides it MIGHT
  //                          say something, before any "thinking"
  //                          happens. Returns a unique token on success,
  //                          or null if something else already holds
  //                          the lock (see SERIALIZATION below).
  //   finishTypingAndSend(text, token) — call once the reply text is
  //                          actually ready. Pass the token from
  //                          acquireSpeakerLock() if you have one (so
  //                          the same bubble is reused rather than a
  //                          second one opened); pass nothing to take
  //                          the lock fresh right now instead. Keeps
  //                          the bubble up for a short extra beat
  //                          proportional to message length (an
  //                          already-composed reply still takes a
  //                          moment to "type out"), then swaps it for
  //                          the real chat message.
  // emitChat(text) below is a convenience wrapper for callers with no
  // separate "thinking" phase to cover, e.g. banter, which is a
  // scripted one-liner with no real async work between deciding to
  // speak and having the text ready.
  //
  // SERIALIZATION: banter (its own independent timer), guesses/decoys,
  // and conversational replies (triggered by the human's own chat) can
  // all decide to speak within moments of each other — e.g. the human
  // sends a taunt right as the independent banter timer also fires, or
  // even sends two messages close together, each spawning its own
  // BotChat.getReply() call. Without coordination, two overlapping
  // "compose" cycles would each try to own the single typing bubble and
  // each schedule their own stop+send, causing one message's
  // typing_stop to cut off the other's still-in-progress bubble, two
  // chat lines to land back-to-back with no bubble between them, or (a
  // real bug hit during testing) a LATE-resolving promise from an
  // earlier, already-finished compose cycle mistaking the lock's
  // current (unrelated, newer) holder for its own and firing an
  // orphaned typing_stop/double-send.
  //
  // Fixed with token-based ownership rather than a bare boolean: each
  // time a compose cycle successfully acquires the lock it's handed a
  // unique `pendingSpeakerToken`. Any code that resolves later (a
  // promise, a setTimeout) must present that SAME token before it's
  // allowed to touch the bubble/send — if the token it was given no
  // longer matches the current one, the lock has since moved on to a
  // different, newer message, and that stale attempt is a no-op instead
  // of corrupting the newer one's state. A bare boolean can't tell two
  // different owners apart; a token can.
  let pendingSpeakerToken = null; // null when free; otherwise a unique object identifying whoever currently holds the "bot is composing" lock
  let queuedSpeak = null; // a single deferred `() => {...}` to run once the lock frees up; newer requests overwrite older still-queued ones rather than stacking up a backlog

  function runQueuedSpeakIfAny() {
    if (queuedSpeak) {
      const fn = queuedSpeak;
      queuedSpeak = null;
      fn();
    }
  }

  // Tries to acquire the lock fresh. Returns the token on success (the
  // caller must hang onto it and pass it to finishTypingAndSend), or
  // null if something else already holds it (caller should NOT show a
  // bubble/send in that case — it should have gone through
  // speakOrQueue instead, or simply skip its optional pre-roll).
  function acquireSpeakerLock() {
    if (roundOver || pendingSpeakerToken) return null;
    pendingSpeakerToken = {};
    messageHandlers.forEach(fn => fn({ type: 'typing_start', name: botName }));
    return pendingSpeakerToken;
  }

  // finishTypingAndSend now takes the token the caller was given by
  // acquireSpeakerLock (or omits it, meaning "I never tried to
  // pre-acquire, just take the lock fresh right now"). If a token IS
  // passed but no longer matches the live pendingSpeakerToken, someone
  // else has since
  // taken over the lock (e.g. this call is a stale promise resolving
  // late after a different message already finished and moved on) —
  // in that case this is a safe no-op rather than corrupting the
  // current, unrelated holder's in-flight bubble/timer.
  function finishTypingAndSend(text, token) {
    if (roundOver) {
      if (token === undefined || token === pendingSpeakerToken) {
        if (pendingSpeakerToken) messageHandlers.forEach(fn => fn({ type: 'typing_stop' }));
        pendingSpeakerToken = null;
        runQueuedSpeakIfAny();
      }
      return; // round ended while composing — don't send a stale line, but still clear the bubble if it was ours
    }
    if (token !== undefined && token !== null && token !== pendingSpeakerToken) {
      return; // stale caller — the lock has since moved on to someone else; do nothing
    }
    if (!pendingSpeakerToken) {
      pendingSpeakerToken = {};
      messageHandlers.forEach(fn => fn({ type: 'typing_start', name: botName }));
    }
    const myToken = pendingSpeakerToken;
    // ~180-260ms per character, the way a quick but human phone-typer
    // sends a short chat line, clamped to a sane 500ms-2.6s window so a
    // one-word reply doesn't feel sluggish and a long line doesn't stall
    // the chat for ages. This is deliberately still applied even for an
    // API reply that already took real network time to arrive — the
    // TOTAL bubble duration ends up being "thinking time" (however long
    // the API/decoy-guess wait actually was) PLUS this "typing it out"
    // beat, which reads as more human than either alone.
    const perChar = 180 + Math.random() * 80;
    const typingMs = Math.min(2600, Math.max(500, text.length * perChar));
    setTimeout(() => {
      // Re-check ownership before touching anything — myToken should
      // always still equal pendingSpeakerToken at this point given the
      // guards above (nothing else can steal an already-acquired lock
      // mid-flight), but checking is free and keeps this function
      // provably safe to reason about on its own.
      if (myToken !== pendingSpeakerToken) return;
      messageHandlers.forEach(fn => fn({ type: 'typing_stop' }));
      pendingSpeakerToken = null;
      if (roundOver) { runQueuedSpeakIfAny(); return; } // round ended mid-"typing" — don't send a stale line after the fact, but still let anything queued (which will itself no-op on the roundOver check) clear out
      emit({ type: 'chat', text, name: botName, msgId: 'bot' + Date.now() });
      runQueuedSpeakIfAny(); // now that this message is fully sent, let whatever collided with it (a banter tick, another reply, etc.) take its turn
    }, typingMs);
  }

  // Runs `speakFn` now if nothing else is mid-compose, or defers it to
  // run immediately after the current one finishes. Every caller that
  // can independently decide to speak (banter's timer, a guess-tick, a
  // conversational reply) should go through this rather than calling
  // finishTypingAndSend() directly, so overlapping triggers queue up
  // one-at-a-time instead of colliding.
  function speakOrQueue(speakFn) {
    if (roundOver) return;
    if (pendingSpeakerToken) {
      queuedSpeak = speakFn; // last-writer-wins if multiple things pile up during one busy stretch — still better than an ever-growing backlog of stale banter firing minutes later
      return;
    }
    speakFn();
  }

  // Convenience wrapper for callers with no separate "thinking" phase —
  // finishTypingAndSend already self-starts the bubble if it isn't
  // showing yet (see its own comment above), so this is just a thin
  // named alias for readability at simple call sites like banter.
  function emitChat(text) {
    speakOrQueue(() => finishTypingAndSend(text));
  }

  function clearTimers() {
    clearTimeout(drawTimer);
    clearTimeout(guessTimer);
    clearTimeout(roundTimeoutTimer);
    clearTimeout(banterTimer);
    drawQueue = [];
    roundOver = false;
    humanHasStartedDrawing = false;
    strokeCountThisRound = 0;
    banterFiredThisRound = 0;
    cluesRevealedCount = 0;
    // guesserState must NOT survive into a new turn. Without this reset,
    // a round where the bot draws (no guesserState touched at all) left
    // the PREVIOUS round's guesser state (its old pattern, its old
    // triedGuesses set, and critically its old knownAnswer) sitting
    // around. Two rounds later when the bot became guesser again,
    // chooseGuessLocal()'s very first check
    // (`if (state.knownAnswer && ...) return state.knownAnswer`) could
    // fire on that STALE knownAnswer before the new round's word_length/
    // clue messages ever arrived to correct it — silently guessing the
    // previous round's word, or (once triedGuesses already contained
    // every plausible candidate from last time) finding nothing left to
    // say and going quiet for the rest of the round. startBotGuessing()
    // already creates a fresh state on its own, so this null just
    // guarantees no stale object is reachable in the gap between one
    // turn ending and the next one's setup running.
    guesserState = null;
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
    cluesRevealedCount = 0;
    clues.forEach((text, i) => {
      setTimeout(() => {
        if (roundOver) return;
        cluesRevealedCount = i + 1;
        emit({ type: 'clue', text });
      }, 4000 + i * 12000);
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

    // Drip out strokes/fills over roughly 40 seconds so the sketch builds
    // up progressively instead of appearing all at once, while still
    // leaving the player a solid chunk of the 70s round to actually guess
    // once the drawing is done.
    const totalMs = 40000;
    const perItem = Math.max(45, totalMs / Math.max(1, drawQueue.length));
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
    startBanterLoop(); // independent of the stroke pacer above — fires on its own schedule regardless of drawing progress
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
    startBanterLoop(); // independent of the guess-tick loop below — fires on its own schedule regardless of whether a guess also fires that tick
    let tickCount = 0;
    function tick() {
      tickCount += 1;
      // First tick waits a bit longer (word_length/first clue need to
      // arrive first); later ticks are a touch snappier.
      const base = tickCount === 1 ? 5000 : 3500;
      const delay = base + Math.random() * 4000;
      // Show the typing bubble for the LAST ~1.2-2s of this wait rather
      // than only right as the guess is about to be sent — reads as
      // "bot pauses/reads the clue, THEN starts typing its guess"
      // instead of the bubble appearing to come from nowhere at the
      // very last instant. Purely cosmetic pre-roll; the actual
      // guess-decision logic below is unaffected either way. Skipped
      // entirely if something else (banter, a reply) is already
      // mid-compose — acquireSpeakerLock() itself no-ops in that case
      // (returns null), so this is just avoiding scheduling pointless
      // work, not a correctness requirement.
      //
      // myPreRollToken (captured in THIS tick()'s own closure) is what
      // makes this safe against the exact race that used to bite the
      // old boolean-flag version: two different tick() calls, or a
      // tick() overlapping a conversational reply, could no longer tell
      // each other's lock ownership apart. Now each attempt only ever
      // acts on the token IT was personally handed back.
      let myPreRollToken = null;
      const typingLeadMs = Math.min(delay - 300, 1200 + Math.random() * 800);
      if (typingLeadMs > 300) {
        setTimeout(() => { myPreRollToken = acquireSpeakerLock(); }, delay - typingLeadMs);
      }
      guessTimer = setTimeout(() => {
        if (roundOver) return;
        // Never guess (not even a scripted decoy) until the human has
        // actually put pen to canvas this round — an "answer" arriving
        // before any line exists reads as the bot cheating/psychic, even
        // when that answer is deliberately wrong. Keep polling quietly
        // at the same cadence instead of guessing blind.
        if (!humanHasStartedDrawing) {
          if (myPreRollToken && myPreRollToken === pendingSpeakerToken) {
            messageHandlers.forEach(fn => fn({ type: 'typing_stop' }));
            pendingSpeakerToken = null;
            runQueuedSpeakIfAny();
          }
          tick();
          return;
        }
        const guess = BotBrain.chooseGuess(guesserState);
        if (roundOver) return;
        if (guess) {
          // If our own pre-roll above successfully acquired the lock
          // AND still owns it (nobody else could have taken it in
          // between, since acquireSpeakerLock only hands out a token
          // when free), pass that exact token through so
          // finishTypingAndSend reuses the same open bubble instead of
          // re-acquiring. Otherwise — pre-roll window was too short to
          // schedule, OR something else grabbed the lock first and our
          // pre-roll returned null — go through speakOrQueue so we
          // either take the lock fresh or queue politely behind
          // whatever's currently speaking, rather than barging in.
          if (myPreRollToken) finishTypingAndSend(guess, myPreRollToken);
          else speakOrQueue(() => finishTypingAndSend(guess));
        } else if (myPreRollToken && myPreRollToken === pendingSpeakerToken) {
          messageHandlers.forEach(fn => fn({ type: 'typing_stop' })); // pre-roll fired but there's nothing to say this tick — clear OUR OWN bubble
          pendingSpeakerToken = null;
          runQueuedSpeakIfAny();
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
        case 'chat': {
          // Human typed a chat message — could be a real guess attempt at
          // the secret word, or just them talking ("bhai hara diya na",
          // trash talk, a random comment). The exact-match "did they get
          // it right" check only makes sense when the BOT is drawing
          // (secretWord is only ever populated on that side — see
          // getRandomWordForBot() above, only called from the drawer
          // branch); when the bot is guessing, correctness is the human
          // drawer's own client's job, not ours. But conversational
          // replies should work in BOTH directions — the human might
          // chat at the bot regardless of who's drawing — so that part
          // runs unconditionally below.
          if (roundOver) break;
          // Same normalization as Game.drawerChecksGuess in js/game.js
          // (strips accents/punctuation/whitespace, not just whitespace)
          // — kept as an identical local copy rather than a shared
          // import since this file has no module system to pull from
          // game.js with, but the two must stay in sync so a human
          // guessing against the bot gets exactly the same leniency
          // ("auto-rickshaw!" counting correct) as guessing against a
          // real friend.
          const norm = t => t
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase()
            .replace(/[.,!?'"''""\-_]/g, '')
            .replace(/\s+/g, '');
          if (botIsDrawer && secretWord && norm(data.text) === norm(secretWord)) {
            roundOver = true;
            clearTimeout(roundTimeoutTimer);
            emit({ type: 'correct_guess', word: secretWord });
            break;
          }

          // Not a correct-answer match (or bot is guessing, where this
          // check doesn't apply anyway). Decide whether it even LOOKS
          // like a guess attempt versus plain chat — BotBrain's own
          // guessing logic elsewhere already handles actual right/wrong
          // scoring on both sides; this is purely about whether the bot
          // should say something back. wordLen is only available (and
          // only useful as a soft signal) when the bot itself is
          // drawing and therefore knows the secret word; when the bot
          // is guessing, classification just runs without that hint.
          const wordLen = (botIsDrawer && secretWord) ? secretWord.replace(/\s+/g, '').length : null;
          const kind = BotChat.classifyMessage(data.text, wordLen);
          if (kind !== 'conversational') break; // looked like a guess attempt — bot doesn't need to comment on every miss

          const roundContext = botIsDrawer
            ? 'bot is currently drawing, human is guessing'
            : 'human is currently drawing, bot is guessing';
          // The human directly addressed the bot here — try to grab the
          // typing-bubble lock immediately (covers the bot's full
          // "thinking" time, including a possibly slow real-network
          // BotChat.getReply() call, not just a brief tail-delay before
          // sending) but WITHOUT forcing it: acquireSpeakerLock() itself
          // returns null if something else (banter, a guess-tick)
          // already holds the lock, so this never collides with/steals
          // another in-flight message's bubble. Either way, kick off
          // getReply() regardless of whether we got the lock —
          // thinking/composing the text doesn't need it, only showing
          // the bubble + sending does. myReplyToken (captured in THIS
          // handler's own closure) is what lets the .then() below tell
          // "did I keep the lock the whole time" apart from "someone
          // else has since taken over" — the exact ambiguity that used
          // to cause a late-resolving reply to steal/corrupt a newer,
          // unrelated message's in-flight bubble when two human chats
          // arrived close together (each spawning its own getReply()).
          const myReplyToken = acquireSpeakerLock();
          BotChat.getReply(data.text, botIsDrawer, roundContext).then(reply => {
            if (roundOver) return; // round ended while the reply was in flight — nothing to show or send
            if (myReplyToken && myReplyToken === pendingSpeakerToken) {
              finishTypingAndSend(reply, myReplyToken); // we still hold the lock we opened above — reuse it
            } else {
              speakOrQueue(() => finishTypingAndSend(reply)); // never acquired it, or someone else has since taken over — queue politely instead of barging in
            }
          });
          break;
        }
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
        case 'stroke':
        case 'fill':
          // The human (drawer) actually marked the canvas — from now on
          // the bot-as-guesser is allowed to speak this round. Harmless
          // no-op when the bot itself is the drawer (its own strokes
          // never round-trip back through send()).
          if (!botIsDrawer) {
            humanHasStartedDrawing = true;
            strokeCountThisRound += 1;
          }
          break;
        case 'clear':
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
