// ===== api/bot-brain.js — Vercel serverless function =====
// Proxies OpenRouter chat-completions so the API key never reaches the
// browser. Two modes, selected by `mode` in the POST body:
//   - "draw"  : given a word, return a JSON list of stroke primitives
//   - "guess" : given pattern/revealed letters/clues/tried guesses, return one guess word
//
// Both modes ask the model for JSON-only output and validate it before
// returning, so a malformed/partial LLM response can never break the
// frontend's drawing pacer or reveal something unexpected in chat.

const MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// ---- Prompts ----

function drawSystemPrompt() {
  return `You are generating a SIMPLE line-art sketch as drawing instructions for a Skribbl-style game, in a normalized 0-1 coordinate square (0,0 = top-left, 1,1 = bottom-right).

Return ONLY a JSON array, nothing else — no markdown fences, no commentary. Each element is one "beat" (a recognizable part drawn together):
[
  { "shape": "line", "points": [[x1,y1],[x2,y2],...], "color": "#1a1a22", "width": 4 },
  { "shape": "circle", "cx": 0.5, "cy": 0.5, "r": 0.2, "color": "#1a1a22", "width": 4 },
  { "shape": "ellipse", "cx": 0.5, "cy": 0.5, "rx": 0.2, "ry": 0.1, "color": "#1a1a22", "width": 4 }
]

Rules:
- 4 to 10 beats total. Keep it simple and iconic — a human sketching fast, not fine art.
- All coordinates must stay within 0.05 to 0.95.
- Use "line" with a "points" polyline for straight/angular parts (2+ points).
- Use black (#1a1a22) for outlines; you may use one accent color (e.g. "#e63946" red, "#3a86ff" blue, "#f4a300" orange, "#2a9d8f" teal) for a single distinguishing detail if the object has an obvious signature color.
- Never write any text, letters, or numbers in the drawing.
- Output nothing except the JSON array.`;
}

function guessSystemPrompt() {
  return `You are playing the guessing role in a Skribbl-style drawing game. You are given the current known letter pattern, any confirmed letters, clue sentences received so far, and guesses already tried (which were wrong). Reply with ONLY the single word or short phrase you think is the answer — nothing else, no punctuation, no explanation. If you have no reasonable guess yet, reply with exactly: PASS`;
}

function buildGuessUserPrompt({ pattern, revealed, clues, tried }) {
  const patternStr = pattern || '(unknown length)';
  const revealedStr = revealed && Object.keys(revealed).length
    ? Object.entries(revealed).map(([i, ch]) => `position ${i}: "${ch}"`).join(', ')
    : 'none yet';
  const cluesStr = clues && clues.length ? clues.map((c, i) => `${i + 1}. ${c}`).join('\n') : '(none yet)';
  const triedStr = tried && tried.length ? tried.join(', ') : 'none';

  return `Letter pattern (spaces = word breaks, each letter = one blank): ${patternStr}
Revealed letters: ${revealedStr}
Clues received so far:
${cluesStr}
Already-tried wrong guesses (do not repeat these): ${triedStr}

What is your single best guess right now?`;
}

// ---- Validation helpers ----

function clamp01(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0.5;
  return Math.min(0.95, Math.max(0.05, v));
}

function sanitizeDrawPlan(raw) {
  if (!Array.isArray(raw)) return null;
  const beats = [];
  const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

  for (const item of raw.slice(0, 12)) {
    if (!item || typeof item !== 'object') continue;
    const color = COLOR_RE.test(item.color) ? item.color : '#1a1a22';
    const width = Number.isFinite(Number(item.width)) ? Math.min(8, Math.max(1, Number(item.width))) : 4;

    if (item.shape === 'line' && Array.isArray(item.points) && item.points.length >= 2) {
      const pts = item.points
        .filter(p => Array.isArray(p) && p.length === 2)
        .slice(0, 20)
        .map(p => [clamp01(p[0]), clamp01(p[1])]);
      if (pts.length >= 2) beats.push({ shape: 'line', points: pts, color, width });
    } else if (item.shape === 'circle' && item.cx !== undefined && item.cy !== undefined && item.r !== undefined) {
      beats.push({ shape: 'circle', cx: clamp01(item.cx), cy: clamp01(item.cy), r: Math.min(0.4, Math.max(0.02, Number(item.r) || 0.1)), color, width });
    } else if (item.shape === 'ellipse' && item.cx !== undefined && item.cy !== undefined) {
      beats.push({
        shape: 'ellipse', cx: clamp01(item.cx), cy: clamp01(item.cy),
        rx: Math.min(0.4, Math.max(0.02, Number(item.rx) || 0.15)),
        ry: Math.min(0.4, Math.max(0.02, Number(item.ry) || 0.1)),
        color, width,
      });
    }
  }
  return beats.length > 0 ? beats : null;
}

function extractJson(text) {
  if (!text) return null;
  // Strip markdown fences if the model wrapped its output anyway.
  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fallback: grab the first [...] or {...} block in the text.
    const match = cleaned.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { return null; }
    }
    return null;
  }
}

// ---- OpenRouter call ----

async function callOpenRouter(messages, maxTokens) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

  // The free Nemotron model on OpenRouter can queue for a long time.
  // Without an internal timeout, a slow response gets hard-killed by
  // Vercel's platform timeout instead of failing gracefully here, which
  // is what was showing up as bare 502s in the logs. Abort at 18s so we
  // always have time to return a clean JSON error response ourselves
  // (well under the 25s maxDuration set in vercel.json).
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);

  let res;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://guessart.vercel.app',
        'X-Title': 'GuessArt Bot',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: maxTokens,
        temperature: 0.8,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('OpenRouter request timed out after 18s');
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

// ---- Handler ----

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  try {
    if (body.mode === 'draw') {
      const word = String(body.word || '').trim().slice(0, 60);
      if (!word) return res.status(400).json({ error: 'word required' });

      const raw = await callOpenRouter([
        { role: 'system', content: drawSystemPrompt() },
        { role: 'user', content: `Word to sketch: "${word}"` },
      ], 900);

      const parsed = extractJson(raw);
      const beats = sanitizeDrawPlan(parsed);
      if (!beats) return res.status(502).json({ error: 'model returned unusable drawing JSON' });
      return res.status(200).json({ beats });
    }

    if (body.mode === 'guess') {
      const raw = await callOpenRouter([
        { role: 'system', content: guessSystemPrompt() },
        { role: 'user', content: buildGuessUserPrompt(body) },
      ], 30);

      const guess = String(raw || '').trim().replace(/^["'.]+|["'.]+$/g, '').toLowerCase();
      if (!guess || guess === 'pass' || guess.length > 40) {
        return res.status(200).json({ guess: null });
      }
      return res.status(200).json({ guess });
    }

    return res.status(400).json({ error: 'mode must be "draw" or "guess"' });
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err) });
  }
};
