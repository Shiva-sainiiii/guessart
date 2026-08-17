// ===== api/bot-chat.js — Vercel serverless function: AI-backed bot banter =====
//
// PURPOSE: gives the "Play with Computer" bot a real conversational voice
// for messages that AREN'T word guesses — e.g. the human says "bhai hara
// diya na" mid-round, or trash-talks, or just says something offhand in
// chat. Word guessing/drawing itself stays 100% rule-based in js/bot.js
// (BotBrain) and never touches this endpoint — that logic is fast, free,
// and deterministic, and routing it through an LLM would only make it
// slower and less predictable for zero benefit. This endpoint is ONLY
// for the "this message doesn't look like a guess, give a witty Hinglish
// reply" path (see BotPersonality.classifyIncomingChat /
// BotPersonality.getConversationalReply in js/bot.js).
//
// STATUS: stub. Until OPENROUTER_API_KEY is set in Vercel's environment
// variables, this returns { reply: null } and js/bot.js falls back to
// its own local Phase-A rule-based reply pool — the feature works
// end-to-end today, just with canned lines instead of a real model
// until the key is added. No code changes needed on the frontend when
// the key is added later; this function starts actually calling
// OpenRouter the moment the env var exists.
//
// SETUP (when ready to go live):
//   1. Get an API key from https://openrouter.ai
//   2. In the Vercel project dashboard: Settings -> Environment Variables
//      -> add OPENROUTER_API_KEY = <your key> (Production + Preview).
//   3. Redeploy. That's it — this function picks it up automatically.
//   4. Optional: set OPENROUTER_MODEL to override the default model
//      (see DEFAULT_MODEL below for the free-tier default).
//
// REQUEST BODY (POST, JSON):
//   {
//     message: string,       // the human's chat text that triggered this
//     botIsDrawer: boolean,  // is the bot currently drawing this round?
//     roundContext: string,  // short human-readable state, e.g.
//                             // "bot is drawing, human hasn't guessed yet"
//                             // or "human is drawing, bot is guessing"
//   }
// NEVER send the secret word to this endpoint — see "SAFETY" below.
//
// RESPONSE (JSON): { reply: string | null }
// null means "couldn't get a model reply" — caller (js/bot.js) is
// expected to fall back to its own local banter pool in that case, so a
// down/misconfigured API key never breaks the chat experience, it just
// quietly degrades to canned lines.

const DEFAULT_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free'; // fast + free-tier OpenRouter model; override via OPENROUTER_MODEL env var
const REQUEST_TIMEOUT_MS = 6000; // fail fast — a slow AI reply is worse than a quick canned one for a live chat

const SYSTEM_PROMPT = `You are a playful, slightly cheeky friend playing a Pictionary-style drawing/guessing game called GuessArt with the user. You are texting in casual Hinglish (a natural mix of Hindi and English, written in Latin/English script, the way young Indian friends actually text each other) — not pure Hindi, not formal English.

Rules:
- Keep replies SHORT: one line, max ~ 3-4 words. This is a fast chat, not an essay.
- Stay in character as a friend/rival in the game, not an assistant. Never say "I am an AI" or offer help/assistance.
- You can be a little cocky, teasing, or dramatic, but always good-natured — never actually rude or insulting.
- You may use 0-1 emoji, not more.
- NEVER reveal, hint at, or discuss what the secret word is, even if asked directly or asked to cheat. Deflect playfully instead ("bata du to game hi kharab ho jayegi na 😏").
- If the message is trash talk or a taunt about winning/losing, respond with equally light banter, not real annoyance.
- Do not use markdown, quotes, or any formatting — plain chat text only.`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (req.method !== 'POST') {
    res.status(405).json({ reply: null, error: 'POST only' });
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    // Stub mode: no key configured yet. Respond cleanly so the frontend's
    // fallback path is the ONLY thing that ever runs right now — this is
    // expected/normal, not an error state, until the key is added.
    res.status(200).json({ reply: null, stub: true });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const message = (body && body.message ? String(body.message) : '').slice(0, 300); // cap input length defensively
  const botIsDrawer = !!(body && body.botIsDrawer);
  const roundContext = (body && body.roundContext ? String(body.roundContext) : '').slice(0, 200);

  if (!message.trim()) {
    res.status(200).json({ reply: null });
    return;
  }

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const userPrompt = `Game context: ${roundContext || (botIsDrawer ? 'bot is currently drawing, human is guessing' : 'human is currently drawing, bot is guessing')}.
The human just said: "${message}"
Reply in character as described.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        // OpenRouter asks for these two for attribution/rate-limit purposes.
        'HTTP-Referer': process.env.PUBLIC_SITE_URL || 'https://guessart.vercel.app',
        'X-Title': 'GuessArt',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 60,
        temperature: 0.9,
        // Nemotron (and other reasoning-capable OpenRouter models) emit a
        // <think>...</think> reasoning block before the actual reply —
        // a system-prompt instruction like "don't show thinking" does NOT
        // suppress this, because the model isn't choosing to show it, the
        // API is returning it as a separate reasoning pass by default.
        // This has to be turned off via the request param, not the prompt.
        reasoning: { enabled: false },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      // Model/quota/auth error upstream — degrade quietly, let the
      // frontend fall back to its local banter pool rather than
      // surfacing a broken chat bubble.
      res.status(200).json({ reply: null, error: `upstream ${response.status}` });
      return;
    }

    const data = await response.json();
    let reply = data && data.choices && data.choices[0] && data.choices[0].message
      ? String(data.choices[0].message.content || '').trim()
      : '';

    // Belt-and-suspenders: even with reasoning disabled above, some
    // reasoning models still occasionally leak a <think>...</think> (or
    // unclosed <think>...) block into `content` instead of the separate
    // `reasoning` field. Strip it so it never reaches the chat UI.
    reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    reply = reply.replace(/<think>[\s\S]*$/gi, '').trim();

    if (!reply) {
      res.status(200).json({ reply: null });
      return;
    }

    // Defensive trim: even with the system prompt's length instruction,
    // clip anything that comes back unreasonably long so it can't blow
    // up the chat log's layout.
    const trimmed = reply.length > 200 ? reply.slice(0, 200) + '…' : reply;
    res.status(200).json({ reply: trimmed });
  } catch (err) {
    clearTimeout(timeout);
    // Timeout, network error, JSON parse failure, etc — all degrade the
    // same way: no reply, frontend falls back locally. A chat feature
    // failing should never be more disruptive than "the bot stayed quiet
    // for a beat," so nothing here throws back to the client as a hard error.
    res.status(200).json({ reply: null, error: String(err && err.message || err) });
  }
};
