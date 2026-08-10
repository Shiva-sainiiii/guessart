// ===== connection.js — WebRTC peer connection layer =====
// This module owns the PeerJS connection and exposes a simple send/receive
// interface. Game logic (game.js) subscribes to messages via onMessage.
//
// Reconnect design: PeerJS connections can drop from a network blip, the
// browser backgrounding the tab, or someone accidentally hitting back.
// Both sides keep their PEER ID stable across a dropped connection (the
// host's peer ID IS the room code; the guest's is a random ID it
// remembers for the session), so either side can re-establish the link
// without generating a new room. The HOST stays listening for a fresh
// incoming connection on its existing peer indefinitely. The GUEST
// actively retries connecting to the host's room code with a short
// backoff. Once a data channel reopens, app.js resyncs game state (see
// 'sync_state' in app.js's message protocol) since PeerJS itself has no
// concept of "resuming" a data channel — a reconnect is really a brand
// new RTCDataChannel that just happens to link the same two peers.

const Connection = (() => {
  let peer = null;
  let conn = null;
  let myId = null;
  let roomCode = null; // the host's peer ID — this IS the room code, and what the guest dials to (re)connect
  let isHost = false; // true if this player created the room (goes first)
  let messageHandlers = [];
  let onOpenHandlers = [];
  let onCloseHandlers = [];
  let onReconnectingHandlers = [];
  let onReconnectedHandlers = [];
  let onReconnectFailedHandlers = [];

  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 10;
  let reconnectTimer = null;
  let intentionalClose = false; // true when destroy() is called on purpose — skips auto-reconnect

  function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  function setupConnHandlers() {
    conn.on('open', () => {
      const wasReconnect = reconnectAttempts > 0;
      reconnectAttempts = 0;
      clearTimeout(reconnectTimer);
      onOpenHandlers.forEach(fn => fn());
      if (wasReconnect) onReconnectedHandlers.forEach(fn => fn());
    });
    conn.on('data', (data) => {
      messageHandlers.forEach(fn => fn(data));
    });
    conn.on('close', () => {
      onCloseHandlers.forEach(fn => fn());
      if (!intentionalClose) attemptReconnect();
    });
    conn.on('error', (err) => {
      console.error('[Conn] error:', err);
      if (!intentionalClose) attemptReconnect();
    });
  }

  // Guest side: repeatedly try to dial the host's room code again after
  // a drop. Short, fixed backoff — this is a casual 2-player game, not
  // a production system, so simple beats clever here. Gives up after
  // MAX_RECONNECT_ATTEMPTS and tells the UI to show a "connection lost"
  // state so the person can manually go back and rejoin.
  function attemptReconnect() {
    if (intentionalClose || isHost) return; // host doesn't dial out — see reconnectListenForGuest below
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      onReconnectFailedHandlers.forEach(fn => fn());
      return;
    }
    reconnectAttempts++;
    onReconnectingHandlers.forEach(fn => fn(reconnectAttempts, MAX_RECONNECT_ATTEMPTS));

    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      if (!peer || peer.destroyed) return;
      conn = peer.connect(roomCode, { reliable: true });
      setupConnHandlers();
    }, 1500); // fixed short delay — network blips usually clear within a couple seconds
  }

  return {
    // Create a room. Calls onCode(code) once we have our room code,
    // and onOpenHandlers fire once a peer actually connects.
    createRoom(onCode, onError) {
      isHost = true;
      myId = generateRoomCode();
      roomCode = myId;
      peer = new Peer(myId, { debug: 1 });

      peer.on('open', (id) => onCode(id));

      peer.on('connection', (incomingConn) => {
        // A guest reconnecting after a drop looks identical to the very
        // first connection from the host's side — PeerJS just hands us
        // a fresh incomingConn either way. Swap it in and re-wire.
        const wasReconnect = conn !== null;
        conn = incomingConn;
        setupConnHandlers();
        if (wasReconnect) {
          conn.on('open', () => onReconnectedHandlers.forEach(fn => fn()));
        }
      });

      peer.on('error', (err) => {
        console.error('[Peer] error:', err);
        onError && onError(err);
      });

      peer.on('disconnected', () => {
        // Peer's own signaling connection dropped (not the data
        // channel) — try to get the signaling link back so the host
        // stays reachable at the same room code for the guest to redial.
        if (!intentionalClose && peer && !peer.destroyed) peer.reconnect();
      });
    },

    // Join an existing room by code.
    joinRoom(code, onError) {
      isHost = false;
      myId = generateRoomCode();
      roomCode = code;
      peer = new Peer(myId, { debug: 1 });

      peer.on('open', () => {
        conn = peer.connect(code, { reliable: true });
        setupConnHandlers();

        setTimeout(() => {
          if (!conn.open) {
            onError && onError({ type: 'timeout' });
          }
        }, 8000);
      });

      peer.on('error', (err) => {
        console.error('[Peer] join error:', err);
        onError && onError(err);
      });

      peer.on('disconnected', () => {
        if (!intentionalClose && peer && !peer.destroyed) peer.reconnect();
      });
    },

    send(data) {
      if (conn && conn.open) {
        conn.send(data);
      }
    },

    onMessage(fn) { messageHandlers.push(fn); },
    onOpen(fn) { onOpenHandlers.push(fn); },
    onClose(fn) { onCloseHandlers.push(fn); },
    // Fires each retry attempt: (attemptNumber, maxAttempts) — lets the
    // UI show "Reconnecting... (2/10)".
    onReconnecting(fn) { onReconnectingHandlers.push(fn); },
    // Fires once the data channel is open again after having dropped.
    onReconnected(fn) { onReconnectedHandlers.push(fn); },
    // Fires once all reconnect attempts are exhausted.
    onReconnectFailed(fn) { onReconnectFailedHandlers.push(fn); },

    isHost() { return isHost; },
    myPeerId() { return myId; },
    friendPeerId() { return conn ? conn.peer : null; },
    isConnected() { return !!(conn && conn.open); },
    // Exposes the raw PeerJS `peer` object so VoiceCall can use
    // peer.call()/peer.on('call') for audio, reusing the same
    // signaling connection instead of opening a second one.
    getRawPeer() { return peer; },

    destroy() {
      intentionalClose = true;
      clearTimeout(reconnectTimer);
      if (peer) { peer.destroy(); peer = null; conn = null; }
    },
  };
})();
