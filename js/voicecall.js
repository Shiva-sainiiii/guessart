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

  // Stashed once in autoConnect() so a later redial() (after a WebRTC
  // data-channel reconnect — see app.js's Net.onReconnected) can place
  // a fresh outgoing call without needing app.js to pass everything
  // through again. friendPeerId can change across a reconnect only in
  // theory (PeerJS ids are meant to stay stable across a session), but
  // redial() always re-reads it fresh from getPeerObject()'s owner
  // rather than trusting a stale closure value, so this stays correct
  // even if that assumption is ever wrong.
  let lastGetPeerObject = null;
  let lastIsHost = false;
  let lastGetTargetPeerId = null;
  let lastOnStateChange = null;

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
    //
    // targetPeerId is accepted as either a plain string (original
    // shape) or a function returning the current id — a function lets
    // redial() below always ask Connection for the friend's CURRENT
    // peer id at call time, rather than baking in whatever id existed
    // at the moment autoConnect() first ran.
    async autoConnect(getPeerObject, isHost, targetPeerId, onStateChange) {
      const peer = getPeerObject();
      if (!peer) return;

      // Stash everything redial() needs, so a later reconnect can
      // re-place the call without app.js having to call back in with
      // the same arguments a second time.
      lastGetPeerObject = getPeerObject;
      lastIsHost = isHost;
      lastGetTargetPeerId = typeof targetPeerId === 'function' ? targetPeerId : () => targetPeerId;
      lastOnStateChange = onStateChange;

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

      const resolvedTarget = lastGetTargetPeerId();
      if (isHost && resolvedTarget) {
        try {
          const stream = await getMic();
          const call = peer.call(resolvedTarget, stream);
          wireCallEvents(call, onStateChange);
        } catch (err) {
          console.warn('[VoiceCall] mic permission denied, voice unavailable:', err);
          onStateChange && onStateChange('unavailable');
        }
      }
    },

    // Re-places the call after the underlying WebRTC data connection has
    // dropped and come back (see app.js's Net.onReconnected). A PeerJS
    // 'call' is tied to the RTCPeerConnection of the moment it was
    // placed — it doesn't survive the peer connection dying, even
    // though the signaling `peer` object and its id do. Without this,
    // reconnecting brought text/drawing back to life but left voice
    // silently dead until a full page reload, since nothing ever
    // re-dialed after the very first autoConnect() call.
    //
    // Same asymmetric host/guest shape as autoConnect: the host places
    // a fresh outgoing call (avoids both sides dialing at once), the
    // guest just waits — its 'call' listener from the original
    // autoConnect() is still attached to the same long-lived `peer`
    // object and will catch the host's new incoming call normally.
    async redial() {
      if (!lastGetPeerObject || !lastIsHost) return; // guest: nothing to do, just wait for the incoming call
      const peer = lastGetPeerObject();
      if (!peer) return;

      // Drop any half-dead call object left over from the drop before
      // placing a new one, so wireCallEvents() isn't juggling two.
      if (activeCall) { try { activeCall.close(); } catch (e) {} activeCall = null; }
      connected = false;

      const targetId = lastGetTargetPeerId ? lastGetTargetPeerId() : null;
      if (!targetId) return;

      try {
        const stream = await getMic(); // reuses the existing mic stream/tracks if we already have one
        const call = peer.call(targetId, stream);
        wireCallEvents(call, lastOnStateChange);
      } catch (err) {
        console.warn('[VoiceCall] redial failed:', err);
        lastOnStateChange && lastOnStateChange('unavailable');
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
