// ===== canvas.js — Drawing engine with real-time stroke sync =====
// Coordinates are normalized (0-1 range) before sending, so drawings map
// correctly regardless of each player's screen size.

const DrawCanvas = (() => {
  let canvas, ctx;
  let isDrawing = false;
  let currentColor = '#1a1a22';
  let currentWidth = 4;
  let isEraser = false;
  let lastX = 0, lastY = 0;
  let canDraw = false; // only the active drawer can draw
  let onLocalStroke = null; // callback(strokeData) to send over the wire

  // Stroke history for undo. Each entry is one continuous pen-down..pen-up
  // gesture (an array of segments), so one Undo tap removes one visible
  // "line" the way people expect, not just the last tiny segment.
  let strokeHistory = [];   // array of { segments: [...] }
  let currentGesture = null;
  const MAX_HISTORY = 60;   // cap so long sessions don't grow memory unbounded

  function redrawAll() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    strokeHistory.forEach(gesture => {
      gesture.segments.forEach(s => drawSegmentRaw(s.x1, s.y1, s.x2, s.y2, s.color, s.width, s.erase));
    });
  }

  function drawSegmentRaw(x1, y1, x2, y2, color, width, erase) {
    const rect = canvas.getBoundingClientRect();
    ctx.save();
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1 * rect.width, y1 * rect.height);
    ctx.lineTo(x2 * rect.width, y2 * rect.height);
    ctx.stroke();
    ctx.restore();
  }

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return; // not laid out yet, skip

    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.round(rect.width * dpr);
    const targetHeight = Math.round(rect.height * dpr);

    // Setting canvas.width/height always clears the canvas, even if the
    // value doesn't actually change. Skip the whole resize if the size
    // is unchanged — this was silently wiping strokes that arrived from
    // the remote peer right around a redundant resize (e.g. the
    // requestAnimationFrame follow-up call in init()).
    if (canvas.width === targetWidth && canvas.height === targetHeight) return;

    // Preserve drawing on resize by snapshotting, resizing, redrawing scaled.
    const prev = document.createElement('canvas');
    prev.width = canvas.width;
    prev.height = canvas.height;
    if (canvas.width > 0 && canvas.height > 0) {
      prev.getContext('2d').drawImage(canvas, 0, 0);
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    // Reset transform before rescaling — otherwise repeated resizes
    // (e.g. keyboard open/close, orientation change) compound the scale
    // and touch coordinates stop lining up with what's drawn.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (prev.width > 0 && prev.height > 0) {
      ctx.drawImage(prev, 0, 0, prev.width, prev.height, 0, 0, rect.width, rect.height);
    }
  }

  function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    const x = (point.clientX - rect.left) / rect.width;
    const y = (point.clientY - rect.top) / rect.height;
    return { x, y };
  }

  function handleStart(e) {
    if (!canDraw) return;
    e.preventDefault();
    isDrawing = true;
    const pos = getPointerPos(e);
    lastX = pos.x;
    lastY = pos.y;

    currentGesture = { segments: [] };

    // Send a tiny dot for single taps
    const stroke = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y, color: currentColor, width: currentWidth, erase: isEraser };
    drawSegmentRaw(stroke.x1, stroke.y1, stroke.x2, stroke.y2, stroke.color, stroke.width, stroke.erase);
    currentGesture.segments.push(stroke);
    onLocalStroke && onLocalStroke(stroke);
  }

  function handleMove(e) {
    if (!canDraw || !isDrawing) return;
    e.preventDefault();
    const pos = getPointerPos(e);
    const stroke = { x1: lastX, y1: lastY, x2: pos.x, y2: pos.y, color: currentColor, width: currentWidth, erase: isEraser };
    drawSegmentRaw(stroke.x1, stroke.y1, stroke.x2, stroke.y2, stroke.color, stroke.width, stroke.erase);
    currentGesture && currentGesture.segments.push(stroke);
    onLocalStroke && onLocalStroke(stroke);
    lastX = pos.x;
    lastY = pos.y;
  }

  function handleEnd() {
    isDrawing = false;
    if (currentGesture && currentGesture.segments.length > 0) {
      strokeHistory.push(currentGesture);
      if (strokeHistory.length > MAX_HISTORY) strokeHistory.shift();
    }
    currentGesture = null;
  }

  return {
    init(canvasEl, strokeCallback) {
      canvas = canvasEl;
      ctx = canvas.getContext('2d');
      onLocalStroke = strokeCallback;

      // Canvas's parent might not be laid out yet (e.g. screen still
      // display:none at this exact moment) — resize now and again on the
      // next frame once layout has settled, so we never end up scaled
      // against a 0×0 box. resizeCanvas() itself now no-ops if the size
      // hasn't actually changed, so this can't wipe existing strokes.
      resizeCanvas();
      requestAnimationFrame(resizeCanvas);

      // Debounce window resize (mobile keyboard open/close fires this a
      // lot) so we don't thrash the canvas mid-typing.
      let resizeTimer = null;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resizeCanvas, 200);
      });

      canvas.addEventListener('mousedown', handleStart);
      canvas.addEventListener('mousemove', handleMove);
      canvas.addEventListener('mouseup', handleEnd);
      canvas.addEventListener('mouseleave', handleEnd);

      canvas.addEventListener('touchstart', handleStart, { passive: false });
      canvas.addEventListener('touchmove', handleMove, { passive: false });
      canvas.addEventListener('touchend', handleEnd);
      canvas.addEventListener('touchcancel', handleEnd);
    },

    // Called when a stroke arrives from the remote peer. The guesser's
    // canvas doesn't need undo (only the drawer can undo), so we just
    // paint it directly rather than tracking a parallel history there.
    renderRemoteStroke(stroke) {
      drawSegmentRaw(stroke.x1, stroke.y1, stroke.x2, stroke.y2, stroke.color, stroke.width, stroke.erase);
    },

    // Drawer-side undo: pop the last gesture, repaint locally, and return
    // the flattened remaining segments so app.js can send them to the
    // guesser for an exact replay (simplest correct way to keep both
    // canvases in sync without a heavier diff protocol).
    undo() {
      strokeHistory.pop();
      redrawAll();
      const flatSegments = [];
      strokeHistory.forEach(g => g.segments.forEach(s => flatSegments.push(s)));
      return flatSegments;
    },

    // Guesser-side: receives the drawer's flattened remaining segments
    // after an undo and repaints exactly to match.
    replay(segmentsFlat) {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      segmentsFlat.forEach(s => drawSegmentRaw(s.x1, s.y1, s.x2, s.y2, s.color, s.width, s.erase));
    },

    clear() {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      strokeHistory = [];
      currentGesture = null;
    },

    hasHistory() { return strokeHistory.length > 0; },

    setCanDraw(value) { canDraw = value; },
    setColor(color) { currentColor = color; isEraser = false; },
    setWidth(width) { currentWidth = width; },
    setEraser(value) { isEraser = value; },
    isEraser() { return isEraser; },
    getColor() { return currentColor; },
  };
})();
