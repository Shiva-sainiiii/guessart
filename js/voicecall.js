// ===== voicecall.js — Peer-to-peer voice call (Free-Fire style) =====
//
// Reuses the SAME PeerJS `peer` object that Connection already has open
// for the data channel — no second connection, no signaling server of
// our own. PeerJS's peer.call(id, stream) wraps a full WebRTC audio
// offer/answer/ICE exchange through the existing peer signaling link.
//
// Either side can start the call; the other side gets an incoming-call
// event and auto-answers (this is a 2-friend casual game, not a
// stranger-calling scenario, so there's no need for a ring/accept UI —
// tapping "Start Call" on one side just connects immediately once the
// other side's mic permission resolves).

const VoiceCall = (() => {
  let localStream = null;
  let activeCall = null;
  let isMuted = false;
  let inCall = false;

  const remoteAudioEl = document.getElementById('remote-call-audio');

  async function getMic() {
    if (localStream) return localStream;
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    return localStream;
  }

  function wireCallEvents(call, onStateChange) {
    activeCall = call;
    call.on('stream', (remoteStream) => {
      remoteAudioEl.srcObject = remoteStream;
      inCall = true;
      onStateChange && onStateChange('active');
    });
    call.on('close', () => {
      inCall = false;
      activeCall = null;
      onStateChange && onStateChange('idle');
    });
    call.on('error', (err) => {
      console.error('[VoiceCall] call error:', err);
      inCall = false;
      activeCall = null;
      onStateChange && onStateChange('idle');
    });
  }

  return {
    // Call this once when the game screen loads — listens for an
    // incoming call from the peer and auto-answers with our own mic.
    // getPeerObject is a function returning PeerJS's raw `peer`
    // instance (Connection doesn't expose it directly by default).
    listenForIncomingCalls(getPeerObject, onStateChange) {
      const peer = getPeerObject();
      if (!peer) return;
      peer.on('call', async (call) => {
        try {
          onStateChange && onStateChange('connecting');
          const stream = await getMic();
          call.answer(stream);
          wireCallEvents(call, onStateChange);
        } catch (err) {
          console.error('[VoiceCall] mic permission denied or failed:', err);
          onStateChange && onStateChange('idle');
        }
      });
    },

    // Starts an outgoing call to the given peer ID.
    async startCall(getPeerObject, targetPeerId, onStateChange) {
      const peer = getPeerObject();
      if (!peer || !targetPeerId) return;
      try {
        onStateChange && onStateChange('connecting');
        const stream = await getMic();
        const call = peer.call(targetPeerId, stream);
        wireCallEvents(call, onStateChange);
      } catch (err) {
        console.error('[VoiceCall] failed to start call:', err);
        onStateChange && onStateChange('idle');
        throw err; // let the caller show a permission-denied message
      }
    },

    endCall() {
      if (activeCall) { activeCall.close(); activeCall = null; }
      if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
      remoteAudioEl.srcObject = null;
      inCall = false;
      isMuted = false;
    },

    toggleMute() {
      if (!localStream) return isMuted;
      isMuted = !isMuted;
      localStream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
      return isMuted;
    },

    isInCall() { return inCall; },
    isMuted() { return isMuted; },
  };
})();
