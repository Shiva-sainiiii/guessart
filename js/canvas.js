// ===== canvas.js — Drawing engine with real-time stroke sync =====
// Coordinates are normalized (0-1 range) before sending, so drawings map
// correctly regardless of each player's screen size.

const DrawCanvas = (() => {
  let canvas, ctx;
  let isDrawing = false;
  let currentColor = '#1a1a22';
  let currentWidth = 4;
  let isEraser = false;
  let isFillMode = false;
  let lastX = 0, lastY = 0;
  let canDraw = false; // only the active drawer can draw
  let onLocalStroke = null; // callback(strokeData) to send over the wire
  let onLocalFill = null;   // callback(fillData) to send over the wire

  // History for undo. Each entry is either a stroke gesture
  // { segments: [...] } or a fill action { fill: { x, y, color } }, kept
  // in the order they happened so redraw/undo replays everything correctly.
  let strokeHistory = [];
  let currentGesture = null;
  const MAX_HISTORY = 60;   // cap so long sessions don't grow memory unbounded

  function redrawAll() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    strokeHistory.forEach(entry => {
      if (entry.fill) {
        floodFillRaw(entry.fill.x, entry.fill.y, entry.fill.color);
      } else {
        entry.segments.forEach(s => drawSegmentRaw(s.x1, s.y1, s.x2, s.y2, s.color, s.width, s.erase));
      }
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

  function hexToRgba(hex) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return [r, g, b, 255];
  }

  // Classic 4-directional flood fill on the canvas's raw pixel buffer.
  // x,y come in as normalized (0-1) coordinates, same as strokes, so fills
  // sync and replay identically regardless of each player's canvas size.
  //
  // Wrapped defensively: getImageData/putImageData can throw (e.g. a
  // zero-size canvas mid-resize, or a transient "not enough memory" on
  // very old phones) and a silent failure here is much better than
  // taking down the whole draw loop.
  function floodFillRaw(nx, ny, colorHex) {
    try {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (w === 0 || h === 0 || w !== canvas.width || h !== canvas.height) {
        // Canvas backing size doesn't match what we're about to read —
        // this happens for a frame or two right around a resize. Bail
        // rather than read/write pixels at the wrong dimensions, which
        // would fill the wrong region (or silently no-op, which is
        // exactly the "fill does nothing" symptom).
        return;
      }

      const startX = Math.floor(nx * w);
      const startY = Math.floor(ny * h);
      if (startX < 0 || startY < 0 || startX >= w || startY >= h) return;

      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      const [fr, fg, fb, fa] = hexToRgba(colorHex);

      const startIdx = (startY * w + startX) * 4;
      const startR = data[startIdx], startG = data[startIdx + 1], startB = data[startIdx + 2], startA = data[startIdx + 3];

      // Already filled with this exact color — nothing to do.
      if (startR === fr && startG === fg && startB === fb && startA === fa) return;

      const matches = (idx) =>
        data[idx] === startR && data[idx + 1] === startG && data[idx + 2] === startB && data[idx + 3] === startA;

      // Iterative stack-based fill (recursion would blow the call stack on
      // large canvases). Scanline variant keeps this fast enough for a
      // typical phone-sized drawing area.
      const stack = [[startX, startY]];
      while (stack.length) {
        const [x, y] = stack.pop();
        let leftX = x;
        let idx = (y * w + leftX) * 4;
        while (leftX >= 0 && matches(idx)) { leftX--; idx -= 4; }
        leftX++;

        let rightX = x;
        idx = (y * w + rightX) * 4;
        while (rightX < w && matches(idx)) { rightX++; idx += 4; }
        rightX--;

        for (let i = leftX; i <= rightX; i++) {
          const fillIdx = (y * w + i) * 4;
          data[fillIdx] = fr; data[fillIdx + 1] = fg; data[fillIdx + 2] = fb; data[fillIdx + 3] = fa;

          if (y > 0) {
            const upIdx = ((y - 1) * w + i) * 4;
            if (matches(upIdx)) stack.push([i, y - 1]);
          }
          if (y < h - 1) {
            const downIdx = ((y + 1) * w + i) * 4;
            if (matches(downIdx)) stack.push([i, y + 1]);
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
    } catch (err) {
      console.warn('[DrawCanvas] flood fill failed:', err);
    }
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

    // Re-render from the stored history at the new size, rather than
    // stretching old pixels — this also makes fills re-flow correctly
    // after a resize instead of leaving stale colored regions.
    redrawAll();
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
    const pos = getPointerPos(e);

    if (isFillMode) {
      const fillData = { x: pos.x, y: pos.y, color: currentColor };
      floodFillRaw(fillData.x, fillData.y, fillData.color);
      strokeHistory.push({ fill: fillData });
      if (strokeHistory.length > MAX_HISTORY) strokeHistory.shift();
      onLocalFill && onLocalFill(fillData);
      return;
    }

    isDrawing = true;
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
    if (!canDraw || !isDrawing || isFillMode) return;
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
    init(canvasEl, strokeCallback, fillCallback) {
      canvas = canvasEl;
      ctx = canvas.getContext('2d');
      onLocalStroke = strokeCallback;
      onLocalFill = fillCallback;

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

    // Called when a fill action arrives from the remote peer.
    renderRemoteFill(fillData) {
      floodFillRaw(fillData.x, fillData.y, fillData.color);
    },

    // Drawer-side undo: pop the last entry (stroke gesture OR fill),
    // repaint locally by replaying full history, and return the
    // remaining history so app.js can send it to the guesser for an
    // exact replay (simplest correct way to keep both canvases in sync
    // without a heavier diff protocol).
    undo() {
      strokeHistory.pop();
      redrawAll();
      return strokeHistory.slice();
    },

    // Guesser-side: receives the drawer's remaining history after an
    // undo and repaints exactly to match.
    replay(history) {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      strokeHistory = history.slice();
      redrawAll();
    },

    clear() {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      strokeHistory = [];
      currentGesture = null;
    },

    hasHistory() { return strokeHistory.length > 0; },

    setCanDraw(value) { canDraw = value; },
    setColor(color) { currentColor = color; isEraser = false; isFillMode = false; },
    setWidth(width) { currentWidth = width; },
    setEraser(value) { isEraser = value; if (value) isFillMode = false; },
    setFillMode(value) { isFillMode = value; if (value) isEraser = false; },
    isEraser() { return isEraser; },
    isFillMode() { return isFillMode; },
    getColor() { return currentColor; },
  };
})();
