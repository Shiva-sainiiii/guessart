// ===== connection.js — WebRTC peer connection layer =====
// This module owns the PeerJS connection and exposes a simple send/receive
// interface. Game logic (game.js) subscribes to messages via onMessage.

const Connection = (() => {
  let peer = null;
  let conn = null;
  let myId = null;
  let isHost = false; // true if this player created the room (goes first)
  let messageHandlers = [];
  let onOpenHandlers = [];
  let onCloseHandlers = [];

  function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  function setupConnHandlers() {
    conn.on('open', () => {
      onOpenHandlers.forEach(fn => fn());
    });
    conn.on('data', (data) => {
      messageHandlers.forEach(fn => fn(data));
    });
    conn.on('close', () => {
      onCloseHandlers.forEach(fn => fn());
    });
    conn.on('error', (err) => {
      console.error('[Conn] error:', err);
    });
  }

  return {
    // Create a room. Calls onCode(code) once we have our room code,
    // and onOpenHandlers fire once a peer actually connects.
    createRoom(onCode, onError) {
      isHost = true;
      myId = generateRoomCode();
      peer = new Peer(myId, { debug: 1 });

      peer.on('open', (id) => onCode(id));

      peer.on('connection', (incomingConn) => {
        conn = incomingConn;
        setupConnHandlers();
      });

      peer.on('error', (err) => {
        console.error('[Peer] error:', err);
        onError && onError(err);
      });
    },

    // Join an existing room by code.
    joinRoom(code, onError) {
      isHost = false;
      myId = generateRoomCode();
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
    },

    send(data) {
      if (conn && conn.open) {
        conn.send(data);
      }
    },

    onMessage(fn) { messageHandlers.push(fn); },
    onOpen(fn) { onOpenHandlers.push(fn); },
    onClose(fn) { onCloseHandlers.push(fn); },

    isHost() { return isHost; },
    myPeerId() { return myId; },
    friendPeerId() { return conn ? conn.peer : null; },

    destroy() {
      if (peer) { peer.destroy(); peer = null; conn = null; }
    },
  };
})();
