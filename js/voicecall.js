// ===== voicecall.js — Always-on peer-to-peer voice (Discord-style) =====
//
// No "Start Call" step — the moment both players are connected, we try
// to open a live audio channel automatically in the background. There's
// no ringing/accept UI; this is a 2-friend casual game, not a stranger
// call. Mic and Speaker are two INDEPENDENT toggles:
//   - Mic off  → your audio track is disabled, you still hear them
//   - Speaker off → the remote <audio> element is muted locally, you
//                    still send your own audio
// If mic permission is denied or unavailable, we fail silently — voice
// just doesn't come up, text/emoji/drawing still work fine.

const VoiceCall = (() => {
  let localStream = null;
  let activeCall = null;
  let micOn = true;
  let speakerOn = true;
  let connected = false;
  let micAvailable = false;

  const remoteAudioEl = document.getElementById('remote-call-audio');

  async function getMic() {
    if (localStream) return localStream;
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    micAvailable = true;
    return localStream;
  }

  function wireCallEvents(call, onStateChange) {
    activeCall = call;
    call.on('stream', (remoteStream) => {
      remoteAudioEl.srcObject = remoteStream;
      remoteAudioEl.muted = !speakerOn;
      connected = true;
      onStateChange && onStateChange('connected');
    });
    call.on('close', () => {
      connected = false;
      activeCall = null;
      onStateChange && onStateChange('disconnected');
    });
    call.on('error', (err) => {
      console.error('[VoiceCall] call error:', err);
      connected = false;
      activeCall = null;
      onStateChange && onStateChange('disconnected');
    });
  }

  return {
    // Called once the game screen is up. Silently attempts to open the
    // mic and dial the friend; if the host, we place the call — if not,
    // we just listen for the incoming one. Never throws to the caller;
    // failures just mean voice is unavailable this session.
    async autoConnect(getPeerObject, isHost, targetPeerId, onStateChange) {
      const peer = getPeerObject();
      if (!peer) return;

      // Always listen for an incoming call, regardless of host/guest —
      // covers reconnect scenarios where roles could re-dial either way.
      peer.on('call', async (call) => {
        try {
          const stream = await getMic();
          call.answer(stream);
          wireCallEvents(call, onStateChange);
        } catch (err) {
          console.warn('[VoiceCall] mic unavailable, answering without audio:', err);
          onStateChange && onStateChange('unavailable');
        }
      });

      if (isHost && targetPeerId) {
        try {
          const stream = await getMic();
          const call = peer.call(targetPeerId, stream);
          wireCallEvents(call, onStateChange);
        } catch (err) {
          console.warn('[VoiceCall] mic permission denied, voice unavailable:', err);
          onStateChange && onStateChange('unavailable');
        }
      }
    },

    endCall() {
      if (activeCall) { activeCall.close(); activeCall = null; }
      if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
      remoteAudioEl.srcObject = null;
      connected = false;
      micOn = true;
      speakerOn = true;
    },

    // Independent toggle: only affects whether OUR audio is sent.
    toggleMic() {
      if (!localStream) return micOn;
      micOn = !micOn;
      localStream.getAudioTracks().forEach(t => { t.enabled = micOn; });
      return micOn;
    },

    // Independent toggle: only affects whether WE hear them (local playback mute).
    toggleSpeaker() {
      speakerOn = !speakerOn;
      remoteAudioEl.muted = !speakerOn;
      return speakerOn;
    },

    isConnected() { return connected; },
    isMicOn() { return micOn; },
    isSpeakerOn() { return speakerOn; },
    isMicAvailable() { return micAvailable; },
  };
})();
