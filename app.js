// ===== app.js — Wires up UI + Connection + Canvas + Game =====
//
// Network message protocol (all messages are JSON objects sent via Connection.send):
//   { type: 'hello', name }                         — sent right after connecting, exchange names
//   { type: 'start_turn', drawerIsMe }               — host tells guest whose turn (drawerIsMe is from HOST's perspective, guest flips it)
//   { type: 'word_length', pattern }                 — drawer tells guesser the word's letter/space pattern (e.g. "LLL LLLLL"), so hint blanks can render (actual letters are never sent here)
//   { type: 'hint_reveal', index, letter }            — drawer progressively reveals one letter of the hint row to the guesser
//   { type: 'clue', text }                            — drawer sends a rotating text hint about the word (never contains the word itself)
//   { type: 'voiceline', id }                          — either player triggers a meme voiceline; both clients play it locally
//   { type: 'stroke', x1,y1,x2,y2,color,width }      — a drawing segment
//   { type: 'clear' }                                — drawer cleared the canvas
//   { type: 'undo', segments }                       — drawer removed last stroke; segments is the flattened remaining history to replay
//   { type: 'chat', text, name }                     — chat/guess message
//   { type: 'correct_guess', word }                  — drawer confirms a guess was correct
//   { type: 'timeout' }                              — drawer's timer ran out with no correct guess
//   { type: 'next_turn' }                             — signal to advance after result screen

const screens = {
  home: document.getElementById('screen-home'),
  waiting: document.getElementById('screen-waiting'),
  game: document.getElementById('screen-game'),
  roundResult: document.getElementById('screen-round-result'),
  gameOver: document.getElementById('screen-game-over'),
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

const statusMsg = document.getElementById('status-msg');
function setStatus(msg, isError = false) {
  statusMsg.textContent = msg;
  statusMsg.style.color = isError ? '#ff5c8a' : '#8b8b96';
}

let myName = 'You';
let friendName = 'Friend';
let amHost = false;

const COLORS = ['#1a1a22', '#e63946', '#f4a300', '#2a9d8f', '#3a86ff', '#8338ec', '#ff5c8a', '#ffffff'];

// ---------- HOME SCREEN: name + input validation controls button states ----------
const nameInput = document.getElementById('input-name');
const joinCodeInput = document.getElementById('input-join-code');
const createBtn = document.getElementById('btn-create');
const joinBtn = document.getElementById('btn-join');
const nameInputWrap = document.querySelector('.input-wrap');

function refreshHomeButtonStates() {
  const hasName = nameInput.value.trim().length > 0;
  const hasValidCode = joinCodeInput.value.trim().length >= 4;

  createBtn.disabled = !hasName;
  joinBtn.disabled = !(hasName && hasValidCode);

  // "ready" gives Join Room a visible highlight the moment it becomes
  // tappable, instead of just toggling opacity — makes it obvious the
  // code was accepted.
  joinBtn.classList.toggle('ready', hasName && hasValidCode);
}

nameInput.addEventListener('input', refreshHomeButtonStates);
joinCodeInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  refreshHomeButtonStates();
});

// Gives the field a quick shake instead of a static red warning — only
// fires in the moment someone actually tries to proceed without a name.
function nudgeNameField() {
  nameInputWrap.classList.remove('shake');
  void nameInputWrap.offsetWidth; // restart animation if triggered again quickly
  nameInputWrap.classList.add('shake');
  nameInput.focus();
}

// ---------- Animated typing placeholder for the name field ----------
// Cycles through a few example nicknames, typing and deleting each one,
// so the field feels alive instead of a static gray "Your name" label.
// Disappears the instant the person focuses or types anything real.
(function typingPlaceholder() {
  const el = document.getElementById('name-placeholder');
  const phrases = ['Enter Nickname', 'e.g. Rahul', 'e.g. Priya', 'e.g. Sketchy_99'];
  let phraseIdx = 0, charIdx = 0, deleting = false;
  let timer = null;
  let paused = false;

  function tick() {
    if (paused) return;
    const current = phrases[phraseIdx];

    if (!deleting) {
      charIdx++;
      if (charIdx > current.length) {
        deleting = true;
        timer = setTimeout(tick, 1400); // pause on full phrase before deleting
        renderText(current);
        return;
      }
    } else {
      charIdx--;
      if (charIdx < 0) {
        deleting = false;
        phraseIdx = (phraseIdx + 1) % phrases.length;
        charIdx = 0;
      }
    }

    renderText(current.slice(0, charIdx));
    timer = setTimeout(tick, deleting ? 35 : 70);
  }

  function renderText(text) {
    el.innerHTML = `${text}<span class="cursor"></span>`;
  }

  function stop() {
    paused = true;
    clearTimeout(timer);
    el.classList.add('hidden');
  }

  function start() {
    if (nameInput.value.length > 0) return; // never resume once they've typed something real
    paused = false;
    el.classList.remove('hidden');
    tick();
  }

  nameInput.addEventListener('focus', stop);
  nameInput.addEventListener('input', () => {
    if (nameInput.value.length > 0) stop();
  });
  nameInput.addEventListener('blur', () => {
    if (nameInput.value.length === 0) start();
  });

  tick();
})();

// If someone opened the app via a shared room link (?room=CODE), skip
// straight to "join" mode — hide Create Room entirely so a distracted
// friend can't accidentally start a brand new room instead of joining
// the one they were invited to. Lock the code field too since it's
// already correct; nothing to type there.
(function checkForRoomLinkOnLoad() {
  const params = new URLSearchParams(window.location.search);
  const roomFromLink = params.get('room');
  if (roomFromLink) {
    joinCodeInput.value = roomFromLink.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    joinCodeInput.readOnly = true;
    createBtn.classList.add('hidden');
    document.querySelector('.divider').classList.add('hidden');
    document.getElementById('join-hint').classList.remove('hidden');
    refreshHomeButtonStates();
    nameInput.focus();
  }
})();

refreshHomeButtonStates();

createBtn.addEventListener('click', () => {
  if (createBtn.disabled) { nudgeNameField(); return; }
  myName = nameInput.value.trim();
  amHost = true;
  Connection.createRoom(
    (code) => {
      document.getElementById('room-code-display').textContent = code;
      document.getElementById('waiting-text').textContent = 'Waiting for friend to join...';
      showScreen('waiting');
      setStatus('');
    },
    (err) => setStatus('Connection error: ' + err.type, true)
  );

  Connection.onOpen(() => {
    Connection.send({ type: 'hello', name: myName });
    startGameSession();
  });

  Connection.onMessage(handleMessage);
});

joinBtn.addEventListener('click', () => {
  if (joinBtn.disabled) {
    if (nameInput.value.trim().length === 0) nudgeNameField();
    return;
  }
  myName = nameInput.value.trim();
  const code = joinCodeInput.value.trim().toUpperCase();
  amHost = false;
  setStatus('Connecting...');

  Connection.joinRoom(code, (err) => {
    setStatus(err.type === 'timeout' ? 'Could not connect. Check the code.' : 'Connection failed: ' + err.type, true);
  });

  Connection.onOpen(() => {
    Connection.send({ type: 'hello', name: myName });
    startGameSession();
  });

  Connection.onMessage(handleMessage);
});

document.getElementById('btn-copy-code').addEventListener('click', async () => {
  const code = document.getElementById('room-code-display').textContent;
  try {
    await navigator.clipboard.writeText(code);
    const btn = document.getElementById('btn-copy-code');
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => (btn.textContent = original), 1200);
  } catch (e) {}
});

document.getElementById('btn-share-link').addEventListener('click', async () => {
  const code = document.getElementById('room-code-display').textContent;
  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
  const shareText = `Join my Sketch Duel game! Room code: ${code}`;

  if (navigator.share) {
    // Native share sheet — lets them pick WhatsApp, Messages, etc. directly.
    try {
      await navigator.share({ title: 'Sketch Duel', text: shareText, url: shareUrl });
    } catch (e) {
      // User cancelled the share sheet — not an error, do nothing.
    }
  } else {
    // Fallback for browsers without the Web Share API: copy the link instead.
    try {
      await navigator.clipboard.writeText(shareUrl);
      const btn = document.getElementById('btn-share-link');
      const original = btn.textContent;
      btn.textContent = 'Link Copied!';
      setTimeout(() => (btn.textContent = original), 1200);
    } catch (e) {}
  }
});

document.getElementById('btn-cancel-waiting').addEventListener('click', () => {
  Connection.destroy();
  showScreen('home');
});

// ---------- GAME SESSION SETUP ----------
let helloReceived = false;

function handleMessage(data) {
  switch (data.type) {
    case 'hello':
      friendName = data.name;
      helloReceived = true;
      updateScoreLabels();
      break;
    case 'start_turn': {
      // drawerIsMe field is from the SENDER's perspective; flip for us.
      const iAmDrawer = !data.drawerIsMe;
      beginTurnLocal(iAmDrawer, null);
      break;
    }
    case 'word_length':
      HintSystem.setupForGuesser(data.pattern);
      break;
    case 'hint_reveal':
      HintSystem.applyRemoteReveal(data.index, data.letter);
      break;
    case 'clue':
      ClueSystem.applyRemoteClue(data.text);
      break;
    case 'voiceline':
      AudioFX.playVoiceline(data.id);
      break;
    case 'stroke':
      DrawCanvas.renderRemoteStroke(data);
      break;
    case 'clear':
      DrawCanvas.clear();
      break;
    case 'undo':
      DrawCanvas.replay(data.segments);
      break;
    case 'chat':
      handleIncomingChat(data.text, data.name, false, data.msgId);
      break;
    case 'seen':
      markMessageSeen(data.msgId);
      break;
    case 'correct_guess':
      // This message only ever arrives at the GUESSER's client (the drawer
      // detects the match locally and doesn't send this to themselves).
      // So "guesserIsMe" is true here.
      Game.endRoundGuessed(true);
      AudioFX.playCorrectGuess();
      showRoundResult(true, data.word);
      break;
    case 'timeout':
      showRoundResult(false, data.word);
      break;
    case 'next_turn':
      // drawerIsMe is from the HOST's (sender's) perspective; flip for us.
      advanceTurn(!data.drawerIsMe);
      break;
  }
}

function startGameSession() {
  Game.init({
    onTurnStart: onTurnStart,
    onTimerTick: onTimerTick,
    onRoundEnd: () => {}, // handled explicitly via showRoundResult for network sync clarity
    onGameEnd: onGameEnd,
  });

  // Show the game screen FIRST so the canvas's parent has real layout
  // dimensions before we measure it — otherwise resizeCanvas() reads a
  // 0×0 box and touch coordinates never line up with the drawing.
  showScreen('game');

  DrawCanvas.init(document.getElementById('draw-canvas'), (stroke) => {
    Connection.send(Object.assign({ type: 'stroke' }, stroke));
  });

  setupToolbar();
  setupChat();
  setupVoicelineMenu();

  Game.beginGame(amHost);
  updateScoreLabels();

  // Host decides and announces the first turn.
  if (amHost) {
    setTimeout(() => {
      Connection.send({ type: 'start_turn', drawerIsMe: true }); // host draws first
      beginTurnLocal(true, null);
    }, 400);
  }
}

function beginTurnLocal(iAmDrawer, _unused) {
  if (iAmDrawer) {
    const word = Game.startMyTurnAsDrawer();
    HintSystem.setupForDrawer(word, (index, letter) => {
      Connection.send({ type: 'hint_reveal', index, letter });
    });
    // Guesser needs the letter/space pattern to render blank tiles —
    // never the word itself.
    Connection.send({ type: 'word_length', pattern: word.split('').map(ch => (ch === ' ' ? ' ' : 'L')).join('') });
    HintSystem.revealEnds(); // instantly send first+last letter of each word segment
    ClueSystem.startForDrawer(word, (text) => {
      Connection.send({ type: 'clue', text });
    });
  } else {
    Game.startMyTurnAsGuesser();
    ClueSystem.startForGuesser();
  }
}

function onTurnStart({ round, totalRounds, isMyTurn, word }) {
  document.getElementById('round-label').textContent = `Round ${round}/${totalRounds}`;
  const banner = document.getElementById('word-banner');
  const toolbar = document.getElementById('toolbar');
  const overlay = document.getElementById('canvas-overlay');
  overlay.classList.add('hidden');

  if (isMyTurn) {
    banner.innerHTML = `Draw this: <span class="the-word">${word}</span>`;
    toolbar.classList.remove('disabled');
    HintSystem.hideForDrawer();
    ClueSystem.hideForDrawer();
  } else {
    banner.textContent = `${friendName} is drawing — guess in chat!`;
    toolbar.classList.add('disabled');
    // Hint tiles get populated a moment later once the 'word_length'
    // message arrives with the pattern — see handleMessage().
  }

  clearChatSystemMessage();
  addSystemChatMessage(isMyTurn ? 'Your turn to draw!' : `${friendName}'s turn to draw.`);
  AudioFX.playTurnStart();
}

function onTimerTick(t) {
  const el = document.getElementById('timer-display');
  el.textContent = t;
  el.classList.toggle('low', t <= 10);
  HintSystem.onTimerTick(t);

  // Countdown tick plays locally on both clients — no network message
  // needed since both timers start together at turn-start and stay in
  // sync on their own.
  if (t > 0 && t <= 3) {
    AudioFX.playRoundCountdown();
  }

  if (t <= 0 && Game.isDrawerTurn()) {
    // Drawer's client is authoritative for timeout.
    const word = Game.getCurrentWord();
    Connection.send({ type: 'timeout', word });
    showRoundResult(false, word);
  }
}

function showRoundResult(wasGuessed, word) {
  if (!Game.isRoundActive() && document.getElementById('screen-round-result').classList.contains('active')) {
    return; // avoid double-trigger
  }
  Game.endRoundTimeout(); // safe no-op if already ended; ensures timer cleared
  ClueSystem.stop(); // stop the rotating hint timer so it doesn't bleed into the next turn
  const state = Game.getState();

  document.getElementById('result-title').textContent = wasGuessed ? '🎉 Correct!' : '⏱️ Time\'s Up!';
  document.getElementById('result-word').innerHTML = `The word was: <b>${word}</b>`;
  document.getElementById('rr-my-score').textContent = state.myScore;
  document.getElementById('rr-friend-score').textContent = state.friendScore;
  document.getElementById('rr-my-label').textContent = myName;
  document.getElementById('rr-friend-label').textContent = friendName;

  showScreen('roundResult');

  const isLastRound = Game.getRoundNumber() >= Game.getTotalRounds();
  document.getElementById('next-round-text').textContent = isLastRound ? 'Calculating final score...' : 'Next round starting...';

  if (!isLastRound) {
    setTimeout(() => {
      if (amHost) {
        const nextDrawerIsHost = (Game.getRoundNumber() % 2 === 0); // alternate turns
        advanceTurn(nextDrawerIsHost);
        Connection.send({ type: 'next_turn', drawerIsMe: nextDrawerIsHost });
      }
    }, 2500);
  } else {
    setTimeout(() => {
      const s = Game.getState();
      onGameEnd({ myScore: s.myScore, friendScore: s.friendScore });
    }, 2500);
  }
}

function advanceTurn(iAmDrawerNext) {
  showScreen('game');
  beginTurnLocal(iAmDrawerNext, null);
}

function onGameEnd({ myScore, friendScore }) {
  document.getElementById('final-my-score').textContent = myScore;
  document.getElementById('final-friend-score').textContent = friendScore;
  document.getElementById('final-my-label').textContent = myName;
  document.getElementById('final-friend-label').textContent = friendName;

  const title = myScore > friendScore ? '🏆 You Won!' : myScore < friendScore ? '😅 Better Luck Next Time' : '🤝 It\'s a Tie!';
  document.getElementById('game-over-title').textContent = title;

  if (myScore > friendScore) AudioFX.playWin();
  else if (myScore < friendScore) AudioFX.playLose();
  // Tie plays neither — avoids picking a "winner" sound for a draw.

  showScreen('gameOver');
}

document.getElementById('btn-play-again').addEventListener('click', () => {
  Connection.destroy();
  Game.destroy();
  location.reload();
});

function updateScoreLabels() {
  const state = Game.getState ? Game.getState() : { myScore: 0, friendScore: 0 };
  document.getElementById('my-score-label').textContent = `${myName}: ${state.myScore || 0}`;
  document.getElementById('friend-score-label').textContent = `${friendName}: ${state.friendScore || 0}`;
}

// ---------- TOOLBAR ----------
function setupToolbar() {
  const swatchContainer = document.getElementById('color-swatches');
  swatchContainer.innerHTML = '';
  COLORS.forEach((color, i) => {
    const sw = document.createElement('div');
    sw.className = 'swatch' + (i === 0 ? ' active' : '');
    sw.style.background = color;
    sw.addEventListener('click', () => {
      document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      DrawCanvas.setColor(color);
      document.getElementById('btn-eraser').classList.remove('active'); // picking a color exits eraser mode
    });
    swatchContainer.appendChild(sw);
  });
  DrawCanvas.setColor(COLORS[0]);

  const widths = { small: 2, medium: 4, large: 8 };
  Object.keys(widths).forEach(key => {
    document.getElementById(`btn-width-${key}`).addEventListener('click', (e) => {
      document.querySelectorAll('.width-control .btn-icon').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      DrawCanvas.setWidth(widths[key]);
    });
  });
  document.getElementById('btn-width-medium').classList.add('active');

  document.getElementById('btn-eraser').addEventListener('click', (e) => {
    if (!Game.isDrawerTurn()) return;
    const nowErasing = !DrawCanvas.isEraser();
    DrawCanvas.setEraser(nowErasing);
    e.target.classList.toggle('active', nowErasing);
    // Turning the eraser on/off doesn't change the last-picked color
    // swatch highlight — eraser is a separate mode layered on top.
  });

  document.getElementById('btn-undo').addEventListener('click', () => {
    if (!Game.isDrawerTurn() || !DrawCanvas.hasHistory()) return;
    const remainingSegments = DrawCanvas.undo();
    Connection.send({ type: 'undo', segments: remainingSegments });
  });

  document.getElementById('btn-clear-canvas').addEventListener('click', () => {
    if (!Game.isDrawerTurn()) return;
    DrawCanvas.clear();
    Connection.send({ type: 'clear' });
  });
}

// ---------- VOICELINE FAB (radial pie menu) ----------
function setupVoicelineMenu() {
  const fab = document.getElementById('btn-voiceline-fab');
  const menu = document.getElementById('voiceline-menu');
  const backdrop = document.getElementById('voiceline-backdrop');
  const items = AudioFX.VOICELINES;

  // Build the radial buttons once, positioned in an arc above the FAB.
  menu.innerHTML = '';
  const count = items.length;
  const arcSpan = 140; // degrees the buttons fan out across
  const startAngle = -90 - arcSpan / 2; // centered above the FAB, pointing up
  const radius = 92;

  items.forEach((v, i) => {
    const angleDeg = startAngle + (arcSpan / Math.max(1, count - 1)) * i;
    const angleRad = (angleDeg * Math.PI) / 180;
    const x = Math.cos(angleRad) * radius;
    const y = Math.sin(angleRad) * radius;

    const btn = document.createElement('button');
    btn.className = 'voiceline-btn';
    btn.textContent = v.label;
    btn.style.setProperty('--tx', `${x}px`);
    btn.style.setProperty('--ty', `${y}px`);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      AudioFX.playVoiceline(v.id);
      Connection.send({ type: 'voiceline', id: v.id });
      closeMenu();
    });
    menu.appendChild(btn);
  });

  function openMenu() {
    menu.classList.remove('hidden');
    backdrop.classList.remove('hidden');
    fab.classList.add('open');
    requestAnimationFrame(() => menu.classList.add('expanded'));
  }
  function closeMenu() {
    menu.classList.remove('expanded');
    fab.classList.remove('open');
    setTimeout(() => {
      menu.classList.add('hidden');
      backdrop.classList.add('hidden');
    }, 200); // matches the CSS collapse transition
  }

  fab.addEventListener('click', () => {
    const isOpen = !menu.classList.contains('hidden');
    isOpen ? closeMenu() : openMenu();
  });
  backdrop.addEventListener('click', closeMenu);
}

// ---------- CHAT ----------
function setupChat() {
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('btn-send-chat');
  const emojiBtn = document.getElementById('btn-emoji-toggle');
  const emojiPicker = document.getElementById('emoji-picker');

  const EMOJIS = ['😂','🔥','👀','💀','🎨','🤔','😭','👏','🙌','😱','🤯','💯','🐐','👍','😅','🎉'];
  emojiPicker.innerHTML = EMOJIS.map(e => `<span>${e}</span>`).join('');
  emojiPicker.querySelectorAll('span').forEach(span => {
    span.addEventListener('click', () => {
      sendChat(span.textContent);
      emojiPicker.classList.add('hidden');
    });
  });

  emojiBtn.addEventListener('click', () => {
    emojiPicker.classList.toggle('hidden');
  });

  function submit() {
    const text = input.value.trim();
    if (!text) return;
    sendChat(text);
    input.value = '';
  }

  sendBtn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
}

function sendChat(text) {
  const msgId = 'm' + Date.now() + Math.floor(Math.random() * 1000);
  addChatMessage(myName, text, true, false, msgId);
  Connection.send({ type: 'chat', text, name: myName, msgId });
}

function handleIncomingChat(text, name, isMine, msgId) {
  addChatMessage(name, text, isMine, false, msgId);

  // Acknowledge we've seen it, so the sender's ticks turn blue.
  if (msgId) {
    Connection.send({ type: 'seen', msgId });
  }

  // If I'm the drawer, check if this incoming guess matches my word.
  if (Game.isDrawerTurn() && Game.isRoundActive()) {
    const isCorrect = Game.drawerChecksGuess(text);
    if (isCorrect) {
      const word = Game.getCurrentWord();
      addCorrectGuessMessage(`🎉 ${name} guessed it! The word was "${word}"`);
      Connection.send({ type: 'correct_guess', word });
      // We are the drawer here, so guesserIsMe = false (friend gets guesser points, we get drawer points).
      Game.endRoundGuessed(false);
      AudioFX.playCorrectGuess();
      showRoundResult(true, word);
    }
  }
}

function formatTime(date) {
  let h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

// Bubbles are grouped in .chat-row wrappers so we can style mine/theirs
// alignment and attach per-message metadata (timestamp + read ticks).
function addChatMessage(sender, text, isMine, isSystem, msgId) {
  const log = document.getElementById('chat-log');
  const row = document.createElement('div');
  row.className = 'chat-row ' + (isMine ? 'mine' : 'theirs');
  if (msgId) row.dataset.msgId = msgId;

  const senderLabel = !isMine ? `<div class="chat-sender">${escapeHtml(sender)}</div>` : '';
  const ticks = isMine ? `<span class="ticks" id="ticks-${msgId}">✓✓</span>` : '';

  row.innerHTML = `
    ${senderLabel}
    <div class="bubble">${escapeHtml(text)}</div>
    <div class="bubble-meta">${formatTime(new Date())}${ticks}</div>
  `;

  log.appendChild(row);
  log.scrollTop = log.scrollHeight;
  updateScoreLabels();
}

function addCorrectGuessMessage(text) {
  const log = document.getElementById('chat-log');
  const row = document.createElement('div');
  row.className = 'chat-row correct-row';
  row.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
  log.appendChild(row);
  log.scrollTop = log.scrollHeight;
}

function addSystemChatMessage(text) {
  const log = document.getElementById('chat-log');
  const row = document.createElement('div');
  row.className = 'chat-row system-row';
  row.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
  log.appendChild(row);
  log.scrollTop = log.scrollHeight;
}

function markMessageSeen(msgId) {
  const el = document.getElementById(`ticks-${msgId}`);
  if (el) el.classList.add('seen');
}

function clearChatSystemMessage() {}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
