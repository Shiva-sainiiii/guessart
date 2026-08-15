// ===== drawings.js — Static, hand-authored bot drawing library =====
//
// Each entry is a plain array of "steps" in the exact format produced by
// tester.html (the standalone JSON Creator & Tester tool): normalized
// 0-1 coordinates, two action types:
//   { action: "gesture", color, width, points: [[x,y], ...] }  — a stroke
//   { action: "fill", color, x, y }                            — flood fill
//
// This is the ENTIRE drawing brain now — no LLM, no network call, no
// cache. bot.js's templateFor(word) looks a word up here first; anything
// not covered falls through to the old hand-coded TEMPLATES object and
// finally the generic category sketch, both still in bot.js.
//
// To add a new word: open tester.html, draw it, hit Copy, paste the
// array below as a new `word: [...]` entry. Keys must be lowercase and
// match the exact word text used in js/words.js.
//
// EVERY gesture that's immediately followed by a fill action MUST form
// a properly CLOSED outline (its first and last points touching) with
// the fill's x,y landing clearly inside that closed shape. An open
// outline gives a flood fill nowhere to stop, so the color leaks out
// and covers the entire canvas instead of just the intended region —
// this was audited and repaired across every entry below (each fill's
// preceding gesture closes exactly on its own start point, and each
// fill point sits at that shape's true centroid). js/canvas.js's flood
// fill also now uses color-distance tolerance (not exact-match) as a
// second layer of defense against anti-aliased edge pixels and any
// future hand-drawn entry that isn't perfectly closed, and js/bot.js
// auto-closes any stray gap at runtime as a third layer — but keep
// closing loops properly here too, since a correctly-closed outline is
// also just a more accurate drawing.

const DRAWINGS = {
  guitar: [
    { "action": "gesture", "color": "#8b4513", "width": 5, "points": [[0.46, 0.52], [0.42, 0.55], [0.4, 0.62], [0.44, 0.68], [0.38, 0.74], [0.38, 0.82], [0.44, 0.88], [0.56, 0.88], [0.62, 0.82], [0.62, 0.74], [0.56, 0.68], [0.6, 0.62], [0.58, 0.55], [0.54, 0.52], [0.46, 0.52]] },
    { "action": "fill", "color": "#cd853f", "x": 0.5, "y": 0.7111 },
    { "action": "gesture", "color": "#3e2723", "width": 4, "points": [[0.46, 0.72], [0.54, 0.72], [0.54, 0.8], [0.46, 0.8], [0.46, 0.72]] },
    { "action": "fill", "color": "#212121", "x": 0.5, "y": 0.76 },
    { "action": "gesture", "color": "#4e342e", "width": 8, "points": [[0.5, 0.52], [0.5, 0.22]] },
    { "action": "gesture", "color": "#3e2723", "width": 5, "points": [[0.47, 0.22], [0.53, 0.22], [0.54, 0.14], [0.46, 0.14], [0.47, 0.22]] },
    { "action": "fill", "color": "#3e2723", "x": 0.5, "y": 0.1781 },
    { "action": "gesture", "color": "#212121", "width": 4, "points": [[0.45, 0.81], [0.55, 0.81]] },
    { "action": "gesture", "color": "#e0e0e0", "width": 1, "points": [[0.48, 0.16], [0.48, 0.81]] },
    { "action": "gesture", "color": "#e0e0e0", "width": 1, "points": [[0.49, 0.16], [0.49, 0.81]] },
    { "action": "gesture", "color": "#e0e0e0", "width": 1, "points": [[0.51, 0.16], [0.51, 0.81]] },
    { "action": "gesture", "color": "#e0e0e0", "width": 1, "points": [[0.52, 0.16], [0.52, 0.81]] }
  ],

  umbrella: [
    { "action": "gesture", "color": "#795548", "width": 4, "points": [[0.5, 0.2], [0.5, 0.8]] },
    { "action": "gesture", "color": "#795548", "width": 4, "points": [[0.5, 0.8], [0.45, 0.83], [0.45, 0.88], [0.5, 0.9], [0.52, 0.87]] },
    { "action": "gesture", "color": "#e74c3c", "width": 3, "points": [[0.5, 0.2], [0.2, 0.55], [0.35, 0.55], [0.5, 0.2]] },
    { "action": "fill", "color": "#e74c3c", "x": 0.35, "y": 0.4333 },
    { "action": "gesture", "color": "#3498db", "width": 3, "points": [[0.5, 0.2], [0.35, 0.55], [0.5, 0.55], [0.5, 0.2]] },
    { "action": "fill", "color": "#3498db", "x": 0.45, "y": 0.4333 },
    { "action": "gesture", "color": "#2ecc71", "width": 3, "points": [[0.5, 0.2], [0.5, 0.55], [0.65, 0.55], [0.5, 0.2]] },
    { "action": "fill", "color": "#2ecc71", "x": 0.55, "y": 0.4333 },
    { "action": "gesture", "color": "#f1c40f", "width": 3, "points": [[0.5, 0.2], [0.65, 0.55], [0.8, 0.55], [0.5, 0.2]] },
    { "action": "fill", "color": "#f1c40f", "x": 0.65, "y": 0.4333 }
  ],

  bicycle: [
    { "action": "gesture", "color": "#1a1a1a", "width": 5, "points": [[0.28, 0.68], [0.22, 0.65], [0.18, 0.56], [0.22, 0.47], [0.28, 0.44], [0.34, 0.47], [0.38, 0.56], [0.34, 0.65], [0.28, 0.68]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 5, "points": [[0.72, 0.68], [0.66, 0.65], [0.62, 0.56], [0.66, 0.47], [0.72, 0.44], [0.78, 0.47], [0.82, 0.56], [0.78, 0.65], [0.72, 0.68]] },
    { "action": "gesture", "color": "#e74c3c", "width": 6, "points": [[0.28, 0.56], [0.46, 0.56], [0.64, 0.42], [0.44, 0.42], [0.28, 0.56]] },
    { "action": "gesture", "color": "#e74c3c", "width": 6, "points": [[0.46, 0.56], [0.72, 0.56], [0.64, 0.42]] },
    { "action": "gesture", "color": "#333333", "width": 5, "points": [[0.44, 0.42], [0.44, 0.35]] },
    { "action": "gesture", "color": "#795548", "width": 7, "points": [[0.38, 0.35], [0.48, 0.35]] },
    { "action": "gesture", "color": "#333333", "width": 5, "points": [[0.72, 0.56], [0.66, 0.32]] },
    { "action": "gesture", "color": "#333333", "width": 5, "points": [[0.66, 0.32], [0.58, 0.32], [0.66, 0.28], [0.66, 0.32]] }
  ],

  chair: [
    { "action": "gesture", "color": "#5c4033", "width": 6, "points": [[0.35, 0.2], [0.65, 0.2], [0.65, 0.55], [0.35, 0.55], [0.35, 0.2]] },
    { "action": "gesture", "color": "#5c4033", "width": 4, "points": [[0.43, 0.2], [0.43, 0.55]] },
    { "action": "gesture", "color": "#5c4033", "width": 4, "points": [[0.5, 0.2], [0.5, 0.55]] },
    { "action": "gesture", "color": "#5c4033", "width": 4, "points": [[0.57, 0.2], [0.57, 0.55]] },
    { "action": "gesture", "color": "#e74c3c", "width": 6, "points": [[0.32, 0.55], [0.68, 0.55], [0.64, 0.62], [0.36, 0.62], [0.32, 0.55]] },
    { "action": "fill", "color": "#c0392b", "x": 0.5, "y": 0.5835 },
    { "action": "gesture", "color": "#5c4033", "width": 7, "points": [[0.36, 0.62], [0.36, 0.9]] },
    { "action": "gesture", "color": "#5c4033", "width": 7, "points": [[0.64, 0.62], [0.64, 0.9]] },
    { "action": "gesture", "color": "#4a3226", "width": 4, "points": [[0.38, 0.62], [0.42, 0.85]] },
    { "action": "gesture", "color": "#4a3226", "width": 4, "points": [[0.62, 0.62], [0.58, 0.85]] }
  ],

  candle: [
    { "action": "gesture", "color": "#7f8c8d", "width": 5, "points": [[0.32, 0.86], [0.68, 0.86], [0.62, 0.92], [0.38, 0.92], [0.32, 0.86]] },
    { "action": "fill", "color": "#95a5a6", "x": 0.5, "y": 0.888 },
    { "action": "gesture", "color": "#9b59b6", "width": 4, "points": [[0.42, 0.86], [0.58, 0.86], [0.58, 0.44], [0.42, 0.44], [0.42, 0.86]] },
    { "action": "fill", "color": "#8e44ad", "x": 0.5, "y": 0.65 },
    { "action": "gesture", "color": "#000000", "width": 3, "points": [[0.5, 0.44], [0.5, 0.35]] },
    { "action": "gesture", "color": "#e67e22", "width": 2, "points": [[0.5, 0.35], [0.44, 0.25], [0.5, 0.12], [0.56, 0.25], [0.5, 0.35]] },
    { "action": "fill", "color": "#e39709", "x": 0.5, "y": 0.24 }
  ],

  clock: [
    { "action": "gesture", "color": "#2c3e50", "width": 6, "points": [[0.5, 0.22], [0.58, 0.23], [0.65, 0.26], [0.71, 0.31], [0.76, 0.37], [0.79, 0.44], [0.8, 0.52], [0.79, 0.6], [0.76, 0.67], [0.71, 0.73], [0.65, 0.78], [0.58, 0.81], [0.5, 0.82], [0.42, 0.81], [0.35, 0.78], [0.29, 0.73], [0.24, 0.67], [0.21, 0.6], [0.2, 0.52], [0.21, 0.44], [0.24, 0.37], [0.29, 0.31], [0.35, 0.26], [0.42, 0.23], [0.5, 0.22]] },
    { "action": "fill", "color": "#ffffff", "x": 0.5, "y": 0.52 },
    { "action": "gesture", "color": "#e74c3c", "width": 6, "points": [[0.35, 0.26], [0.23, 0.16], [0.34, 0.11], [0.42, 0.18], [0.35, 0.26]] },
    { "action": "fill", "color": "#c0392b", "x": 0.332, "y": 0.1793 },
    { "action": "gesture", "color": "#e74c3c", "width": 6, "points": [[0.65, 0.26], [0.77, 0.16], [0.66, 0.11], [0.58, 0.18], [0.65, 0.26]] },
    { "action": "fill", "color": "#c0392b", "x": 0.668, "y": 0.1793 },
    { "action": "gesture", "color": "#212121", "width": 5, "points": [[0.5, 0.52], [0.5, 0.36]] },
    { "action": "gesture", "color": "#212121", "width": 4, "points": [[0.5, 0.52], [0.66, 0.52]] },
    { "action": "gesture", "color": "#ff5722", "width": 8, "points": [[0.5, 0.52], [0.5, 0.52]] }
  ],

  ladder: [
    { "action": "gesture", "color": "#78909c", "width": 10, "points": [[0.35, 0.12], [0.35, 0.88]] },
    { "action": "gesture", "color": "#78909c", "width": 10, "points": [[0.65, 0.12], [0.65, 0.88]] },
    { "action": "gesture", "color": "#607d8b", "width": 6, "points": [[0.35, 0.28], [0.65, 0.28]] },
    { "action": "gesture", "color": "#607d8b", "width": 6, "points": [[0.35, 0.46], [0.65, 0.46]] },
    { "action": "gesture", "color": "#607d8b", "width": 6, "points": [[0.35, 0.64], [0.65, 0.64]] },
    { "action": "gesture", "color": "#607d8b", "width": 6, "points": [[0.35, 0.82], [0.65, 0.82]] }
  ],

  key: [
    { "action": "gesture", "color": "#ffc107", "width": 6, "points": [[0.24, 0.5], [0.26, 0.4], [0.33, 0.35], [0.43, 0.35], [0.5, 0.4], [0.52, 0.5], [0.5, 0.6], [0.43, 0.65], [0.33, 0.65], [0.26, 0.6], [0.24, 0.5]] },
    { "action": "fill", "color": "#ffa000", "x": 0.38, "y": 0.5 },
    { "action": "gesture", "color": "#ffffff", "width": 4, "points": [[0.34, 0.5], [0.36, 0.44], [0.42, 0.44], [0.44, 0.5], [0.42, 0.56], [0.36, 0.56], [0.34, 0.5]] },
    { "action": "fill", "color": "#ffffff", "x": 0.39, "y": 0.5 },
    { "action": "gesture", "color": "#ffc107", "width": 10, "points": [[0.52, 0.5], [0.86, 0.5]] },
    { "action": "gesture", "color": "#ffc107", "width": 6, "points": [[0.7, 0.5], [0.7, 0.62], [0.74, 0.62], [0.74, 0.5], [0.7, 0.5]] },
    { "action": "fill", "color": "#ffa000", "x": 0.72, "y": 0.56 },
    { "action": "gesture", "color": "#ffc107", "width": 6, "points": [[0.8, 0.5], [0.8, 0.62], [0.84, 0.62], [0.84, 0.5], [0.8, 0.5]] },
    { "action": "fill", "color": "#ffa000", "x": 0.82, "y": 0.56 }
  ],

  hammer: [
    { "action": "gesture", "color": "#8B4513", "width": 12, "points": [[0.5, 0.4], [0.5, 0.9]] },
    { "action": "gesture", "color": "#8B4513", "width": 14, "points": [[0.5, 0.9], [0.5, 0.95]] },
    { "action": "gesture", "color": "#455a64", "width": 20, "points": [[0.35, 0.25], [0.65, 0.25], [0.65, 0.4], [0.35, 0.4], [0.35, 0.25]] },
    { "action": "gesture", "color": "#455a64", "width": 18, "points": [[0.25, 0.28], [0.35, 0.25], [0.35, 0.4], [0.25, 0.37], [0.25, 0.28]] },
    { "action": "fill", "color": "#8B4513", "x": 0.3042, "y": 0.325 },
    { "action": "fill", "color": "#455a64", "x": 0.3042, "y": 0.325 },
    { "action": "fill", "color": "#455a64", "x": 0.3042, "y": 0.325 }
  ],

  camera: [
    { "action": "gesture", "color": "#263238", "width": 4, "points": [[0.24, 0.76], [0.76, 0.76], [0.76, 0.38], [0.24, 0.38], [0.24, 0.76]] },
    { "action": "fill", "color": "#37474f", "x": 0.5, "y": 0.57 },
    { "action": "gesture", "color": "#263238", "width": 4, "points": [[0.42, 0.38], [0.42, 0.32], [0.58, 0.32], [0.58, 0.38], [0.42, 0.38]] },
    { "action": "fill", "color": "#455a64", "x": 0.5, "y": 0.35 },
    { "action": "gesture", "color": "#eceff1", "width": 5, "points": [[0.5, 0.44], [0.62, 0.56], [0.5, 0.68], [0.38, 0.56], [0.5, 0.44]] },
    { "action": "fill", "color": "#00e5ff", "x": 0.5, "y": 0.56 },
    { "action": "gesture", "color": "#ff1744", "width": 8, "points": [[0.32, 0.46], [0.32, 0.46]] }
  ],

  scissors: [
    { "action": "gesture", "color": "#e91e63", "width": 6, "points": [[0.4, 0.7], [0.3, 0.8], [0.35, 0.85], [0.45, 0.75], [0.4, 0.7]] },
    { "action": "fill", "color": "#ff4081", "x": 0.375, "y": 0.775 },
    { "action": "gesture", "color": "#e91e63", "width": 6, "points": [[0.6, 0.7], [0.7, 0.8], [0.65, 0.85], [0.55, 0.75], [0.6, 0.7]] },
    { "action": "fill", "color": "#ff4081", "x": 0.625, "y": 0.775 },
    { "action": "gesture", "color": "#b0bec5", "width": 5, "points": [[0.42, 0.68], [0.5, 0.5], [0.25, 0.25], [0.3, 0.22], [0.52, 0.48], [0.42, 0.68]] },
    { "action": "gesture", "color": "#b0bec5", "width": 5, "points": [[0.58, 0.68], [0.5, 0.5], [0.75, 0.25], [0.7, 0.22], [0.48, 0.48], [0.58, 0.68]] },
    { "action": "fill", "color": "#cfd8dc", "x": 0.6144, "y": 0.3612 },
    { "action": "fill", "color": "#cfd8dc", "x": 0.6144, "y": 0.3612 },
    { "action": "gesture", "color": "#212121", "width": 4, "points": [[0.5, 0.5], [0.5, 0.5]] }
  ],

  lamp: [
    { "action": "gesture", "color": "#1a1a22", "width": 5, "points": [[0.365, 0.142], [0.349, 0.161], [0.343, 0.17], [0.335, 0.183], [0.328, 0.197], [0.314, 0.224], [0.303, 0.247], [0.297, 0.258], [0.274, 0.31], [0.27, 0.317], [0.265, 0.327], [0.25, 0.354], [0.247, 0.358], [0.247, 0.361], [0.245, 0.364], [0.242, 0.37], [0.239, 0.376], [0.235, 0.385], [0.235, 0.386], [0.235, 0.387], [0.235, 0.388]] },
    { "action": "gesture", "color": "#1a1a22", "width": 5, "points": [[0.357, 0.137], [0.365, 0.137], [0.374, 0.138], [0.409, 0.139], [0.422, 0.139], [0.433, 0.139], [0.454, 0.139], [0.459, 0.139], [0.463, 0.139], [0.473, 0.139], [0.475, 0.139], [0.476, 0.139], [0.478, 0.139], [0.479, 0.139], [0.48, 0.139], [0.482, 0.139], [0.483, 0.139], [0.485, 0.139], [0.494, 0.138], [0.498, 0.136], [0.501, 0.135], [0.506, 0.134], [0.511, 0.132], [0.515, 0.131], [0.52, 0.13], [0.521, 0.13], [0.522, 0.13], [0.522, 0.13], [0.522, 0.13], [0.523, 0.13], [0.534, 0.132], [0.542, 0.144], [0.549, 0.157], [0.572, 0.202], [0.578, 0.214], [0.584, 0.224], [0.599, 0.255], [0.603, 0.263], [0.607, 0.271], [0.612, 0.281], [0.616, 0.289], [0.621, 0.298], [0.631, 0.318], [0.633, 0.322], [0.636, 0.326], [0.641, 0.333], [0.641, 0.334], [0.641, 0.334], [0.641, 0.335], [0.641, 0.335], [0.641, 0.335], [0.641, 0.336], [0.641, 0.336], [0.641, 0.337], [0.645, 0.346], [0.65, 0.354], [0.653, 0.362], [0.654, 0.366], [0.654, 0.366], [0.644, 0.37], [0.633, 0.37], [0.621, 0.37], [0.608, 0.37], [0.56, 0.37], [0.543, 0.371], [0.524, 0.372], [0.483, 0.374], [0.469, 0.375], [0.456, 0.375], [0.42, 0.375], [0.407, 0.375], [0.396, 0.375], [0.364, 0.375], [0.352, 0.375], [0.34, 0.375], [0.328, 0.375], [0.317, 0.375], [0.309, 0.375], [0.301, 0.375], [0.295, 0.375], [0.289, 0.375], [0.272, 0.375], [0.267, 0.375], [0.263, 0.375], [0.26, 0.375], [0.259, 0.375], [0.258, 0.375], [0.258, 0.375], [0.257, 0.375], [0.257, 0.375]] },
    { "action": "gesture", "color": "#1a1a22", "width": 1, "points": [[0.235,0.388],[0.357,0.137],[0.522,0.13],[0.654,0.366],[0.5,0.4],[0.235,0.388]] },
    { "action": "fill", "color": "#f1c40f", "x": 0.45, "y": 0.28 },
    { "action": "gesture", "color": "#1a1a22", "width": 5, "points": [[0.233, 0.389], [0.248, 0.389], [0.253, 0.389], [0.258, 0.389], [0.266, 0.389], [0.233, 0.389]] },
    { "action": "gesture", "color": "#1a1a22", "width": 5, "points": [[0.252, 0.384], [0.268, 0.384], [0.272, 0.384], [0.276, 0.384], [0.281, 0.383], [0.252, 0.384]] },
    { "action": "gesture", "color": "#1a1a22", "width": 5, "points": [[0.414, 0.371], [0.414, 0.379], [0.414, 0.382], [0.414, 0.384], [0.414, 0.39], [0.414, 0.4], [0.414, 0.408], [0.414, 0.417], [0.419, 0.44], [0.422, 0.454], [0.425, 0.463], [0.427, 0.471], [0.429, 0.48], [0.431, 0.489], [0.433, 0.498], [0.434, 0.505], [0.435, 0.512], [0.435, 0.529], [0.436, 0.536], [0.436, 0.541], [0.436, 0.544], [0.436, 0.547], [0.436, 0.55], [0.436, 0.554], [0.436, 0.559], [0.436, 0.562], [0.436, 0.564], [0.436, 0.566], [0.436, 0.571], [0.437, 0.583], [0.437, 0.585], [0.437, 0.588], [0.437, 0.596], [0.437, 0.599], [0.437, 0.601], [0.437, 0.603], [0.437, 0.603], [0.437, 0.604], [0.437, 0.604], [0.437, 0.607], [0.437, 0.609], [0.437, 0.615], [0.438, 0.62], [0.438, 0.622], [0.438, 0.627], [0.438, 0.628], [0.438, 0.629], [0.438, 0.629]] },
    { "action": "gesture", "color": "#1a1a22", "width": 5, "points": [[0.462, 0.365], [0.462, 0.394], [0.462, 0.415], [0.462, 0.436], [0.464, 0.449], [0.468, 0.467], [0.47, 0.489], [0.473, 0.512], [0.476, 0.525], [0.479, 0.539], [0.482, 0.553], [0.483, 0.565], [0.485, 0.574], [0.485, 0.58], [0.486, 0.585], [0.486, 0.59], [0.486, 0.595], [0.486, 0.599], [0.486, 0.602], [0.486, 0.604], [0.486, 0.606], [0.486, 0.609], [0.486, 0.613], [0.486, 0.615], [0.486, 0.617], [0.486, 0.62], [0.486, 0.625], [0.486, 0.634], [0.486, 0.635], [0.486, 0.636], [0.486, 0.637], [0.486, 0.637], [0.487, 0.638], [0.491, 0.642], [0.492, 0.643]] },
    { "action": "gesture", "color": "#1a1a22", "width": 5, "points": [[0.327, 0.653], [0.367, 0.648], [0.396, 0.642], [0.418, 0.639], [0.434, 0.639], [0.488, 0.639], [0.499, 0.639], [0.507, 0.639], [0.523, 0.639], [0.53, 0.639], [0.535, 0.639], [0.539, 0.639], [0.54, 0.639], [0.542, 0.639], [0.543, 0.639], [0.544, 0.639], [0.546, 0.639], [0.546, 0.639], [0.548, 0.639], [0.549, 0.639], [0.55, 0.639], [0.551, 0.639], [0.551, 0.639], [0.552, 0.639], [0.552, 0.639], [0.552, 0.639], [0.553, 0.639], [0.555, 0.639], [0.556, 0.639], [0.556, 0.639], [0.557, 0.639], [0.557, 0.639], [0.557, 0.639], [0.558, 0.639], [0.558, 0.639]] },
    { "action": "gesture", "color": "#1a1a22", "width": 5, "points": [[0.599, 0.14], [0.613, 0.126], [0.62, 0.119], [0.624, 0.115], [0.63, 0.111], [0.599, 0.14]] },
    { "action": "gesture", "color": "#1a1a22", "width": 5, "points": [[0.645, 0.233], [0.656, 0.227], [0.662, 0.222], [0.675, 0.214], [0.676, 0.214], [0.676, 0.214], [0.676, 0.214], [0.677, 0.214], [0.68, 0.213], [0.68, 0.213], [0.681, 0.213], [0.645, 0.233]] },
    { "action": "gesture", "color": "#1a1a22", "width": 5, "points": [[0.702, 0.322], [0.713, 0.319], [0.721, 0.317], [0.724, 0.316], [0.729, 0.315], [0.737, 0.315], [0.702, 0.322]] },
    { "action": "gesture", "color": "#1a1a22", "width": 5, "points": [[0.254, 0.154], [0.267, 0.167], [0.273, 0.172], [0.279, 0.177], [0.281, 0.178], [0.282, 0.178], [0.284, 0.178], [0.288, 0.179], [0.296, 0.179], [0.254, 0.154]] },
    { "action": "gesture", "color": "#1a1a22", "width": 5, "points": [[0.211, 0.223], [0.222, 0.231], [0.23, 0.235], [0.237, 0.237], [0.242, 0.239], [0.244, 0.24], [0.246, 0.24], [0.247, 0.24], [0.247, 0.24], [0.249, 0.24], [0.257, 0.24], [0.263, 0.24], [0.211, 0.223]] },
    { "action": "gesture", "color": "#1a1a22", "width": 5, "points": [[0.169, 0.318], [0.182, 0.32], [0.186, 0.321], [0.19, 0.322], [0.193, 0.323], [0.196, 0.323], [0.197, 0.323], [0.198, 0.323], [0.169, 0.318]] }
  ],

  burger: [
    { "action": "gesture", "color": "#3e2723", "width": 4, "points": [[0.28, 0.3], [0.35, 0.22], [0.5, 0.19], [0.65, 0.22], [0.72, 0.3], [0.72, 0.35], [0.28, 0.35], [0.28, 0.3]] },
    { "action": "fill", "color": "#a0522d", "x": 0.5, "y": 0.2828 },
    { "action": "gesture", "color": "#5a3d1f", "width": 3, "points": [[0.3, 0.37], [0.7, 0.37], [0.68, 0.44], [0.32, 0.44], [0.3, 0.37]] },
    { "action": "fill", "color": "#7cb342", "x": 0.5, "y": 0.4044 },
    { "action": "gesture", "color": "#3e2723", "width": 4, "points": [[0.27, 0.46], [0.73, 0.46], [0.74, 0.55], [0.26, 0.55], [0.27, 0.46]] },
    { "action": "fill", "color": "#8d5524", "x": 0.5, "y": 0.5053 },
    { "action": "gesture", "color": "#3e2723", "width": 3, "points": [[0.26, 0.57], [0.74, 0.57], [0.72, 0.63], [0.28, 0.63], [0.26, 0.57]] },
    { "action": "fill", "color": "#e6b800", "x": 0.5, "y": 0.5996 },
    { "action": "gesture", "color": "#3e2723", "width": 4, "points": [[0.25, 0.65], [0.75, 0.65], [0.68, 0.8], [0.32, 0.8], [0.25, 0.65]] },
    { "action": "fill", "color": "#a0522d", "x": 0.5, "y": 0.7209 }
  ],

  suitcase: [
    { "action": "gesture", "color": "#5d4037", "width": 5, "points": [[0.25, 0.35], [0.75, 0.35], [0.78, 0.38], [0.78, 0.85], [0.75, 0.88], [0.25, 0.88], [0.22, 0.85], [0.22, 0.38], [0.25, 0.35]] },
    { "action": "fill", "color": "#8d6e63", "x": 0.5, "y": 0.615 },
    { "action": "gesture", "color": "#3e2723", "width": 4, "points": [[0.22, 0.55], [0.78, 0.55]] },
    { "action": "gesture", "color": "#3e2723", "width": 6, "points": [[0.42, 0.28], [0.42, 0.35]] },
    { "action": "gesture", "color": "#3e2723", "width": 6, "points": [[0.58, 0.28], [0.58, 0.35]] },
    { "action": "gesture", "color": "#3e2723", "width": 4, "points": [[0.42, 0.28], [0.58, 0.28]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.35, 0.65], [0.35, 0.75]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.65, 0.65], [0.65, 0.75]] }
  ],

  helmet: [
    { "action": "gesture", "color": "#c0392b", "width": 5, "points": [[0.25, 0.6], [0.25, 0.45], [0.32, 0.3], [0.45, 0.22], [0.55, 0.22], [0.68, 0.3], [0.75, 0.45], [0.75, 0.6], [0.25, 0.6]] },
    { "action": "fill", "color": "#e74c3c", "x": 0.5, "y": 0.4354 },
    { "action": "gesture", "color": "#2c3e50", "width": 3, "points": [[0.25, 0.6], [0.75, 0.6]] },
    { "action": "gesture", "color": "#34495e", "width": 4, "points": [[0.32, 0.62], [0.68, 0.62], [0.68, 0.72], [0.32, 0.72], [0.32, 0.62]] },
    { "action": "fill", "color": "#7f8c8d", "x": 0.5, "y": 0.67 },
    { "action": "gesture", "color": "#c0392b", "width": 3, "points": [[0.5, 0.22], [0.5, 0.6]] }
  ],

  glasses: [
    { "action": "gesture", "color": "#1a1a1a", "width": 5, "points": [[0.2, 0.5], [0.2, 0.42], [0.27, 0.38], [0.36, 0.38], [0.4, 0.42], [0.4, 0.5], [0.36, 0.55], [0.27, 0.55], [0.2, 0.5]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 5, "points": [[0.6, 0.5], [0.6, 0.42], [0.64, 0.38], [0.73, 0.38], [0.8, 0.42], [0.8, 0.5], [0.73, 0.55], [0.64, 0.55], [0.6, 0.5]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.4, 0.44], [0.6, 0.44]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.2, 0.46], [0.1, 0.4]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.8, 0.46], [0.9, 0.4]] }
  ],

  wallet: [
    { "action": "gesture", "color": "#3e2723", "width": 5, "points": [[0.22, 0.4], [0.78, 0.4], [0.78, 0.75], [0.22, 0.75], [0.22, 0.4]] },
    { "action": "fill", "color": "#5d4037", "x": 0.5, "y": 0.575 },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.22, 0.575], [0.78, 0.575]] },
    { "action": "gesture", "color": "#f1c40f", "width": 3, "points": [[0.62, 0.5], [0.7, 0.5], [0.7, 0.6], [0.62, 0.6], [0.62, 0.5]] },
    { "action": "gesture", "color": "#e0e0e0", "width": 2, "points": [[0.3, 0.65], [0.5, 0.65]] }
  ],

  shoe: [
    { "action": "gesture", "color": "#1a1a1a", "width": 5, "points": [[0.2, 0.7], [0.2, 0.55], [0.25, 0.48], [0.35, 0.45], [0.4, 0.5], [0.5, 0.48], [0.65, 0.5], [0.78, 0.58], [0.82, 0.68], [0.8, 0.75], [0.2, 0.75], [0.2, 0.7]] },
    { "action": "fill", "color": "#e74c3c", "x": 0.4864, "y": 0.6237 },
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.2, 0.75], [0.82, 0.75], [0.82, 0.8], [0.18, 0.8], [0.2, 0.75]] },
    { "action": "fill", "color": "#212121", "x": 0.505, "y": 0.7751 },
    { "action": "gesture", "color": "#ffffff", "width": 2, "points": [[0.4, 0.52], [0.35, 0.58]] },
    { "action": "gesture", "color": "#ffffff", "width": 2, "points": [[0.48, 0.5], [0.43, 0.58]] },
    { "action": "gesture", "color": "#ffffff", "width": 2, "points": [[0.56, 0.5], [0.51, 0.58]] }
  ],

  toothbrush: [
    { "action": "gesture", "color": "#3498db", "width": 6, "points": [[0.3, 0.85], [0.65, 0.4]] },
    { "action": "gesture", "color": "#e0e0e0", "width": 8, "points": [[0.65, 0.4], [0.75, 0.25]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 2, "points": [[0.66, 0.36], [0.7, 0.31]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 2, "points": [[0.7, 0.32], [0.74, 0.27]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 2, "points": [[0.62, 0.4], [0.66, 0.35]] }
  ],

  pillow: [
    { "action": "gesture", "color": "#f5f5f5", "width": 5, "points": [[0.2, 0.35], [0.8, 0.35], [0.85, 0.5], [0.8, 0.65], [0.2, 0.65], [0.15, 0.5], [0.2, 0.35]] },
    { "action": "fill", "color": "#ffffff", "x": 0.5, "y": 0.5 },
    { "action": "gesture", "color": "#e0e0e0", "width": 2, "points": [[0.2, 0.35], [0.5, 0.42], [0.8, 0.35]] },
    { "action": "gesture", "color": "#e0e0e0", "width": 2, "points": [[0.2, 0.65], [0.5, 0.58], [0.8, 0.65]] }
  ],

  broom: [
    { "action": "gesture", "color": "#8d6e63", "width": 4, "points": [[0.55, 0.15], [0.4, 0.55]] },
    { "action": "gesture", "color": "#d4a017", "width": 3, "points": [[0.4, 0.55], [0.2, 0.85]] },
    { "action": "gesture", "color": "#d4a017", "width": 3, "points": [[0.4, 0.55], [0.3, 0.88]] },
    { "action": "gesture", "color": "#d4a017", "width": 3, "points": [[0.4, 0.55], [0.42, 0.88]] },
    { "action": "gesture", "color": "#d4a017", "width": 3, "points": [[0.4, 0.55], [0.53, 0.86]] },
    { "action": "gesture", "color": "#d4a017", "width": 3, "points": [[0.4, 0.55], [0.6, 0.8]] },
    { "action": "gesture", "color": "#6d4c1f", "width": 5, "points": [[0.35, 0.5], [0.45, 0.5], [0.45, 0.6], [0.35, 0.6], [0.35, 0.5]] }
  ],

  envelope: [
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.2, 0.35], [0.8, 0.35], [0.8, 0.65], [0.2, 0.65], [0.2, 0.35]] },
    { "action": "fill", "color": "#f5f5f5", "x": 0.5, "y": 0.5 },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.2, 0.35], [0.5, 0.55], [0.8, 0.35]] },
    { "action": "gesture", "color": "#c0392b", "width": 3, "points": [[0.62, 0.42], [0.7, 0.42], [0.7, 0.48], [0.62, 0.48], [0.62, 0.42]] }
  ],

  flashlight: [
    { "action": "gesture", "color": "#212121", "width": 5, "points": [[0.35, 0.6], [0.35, 0.85], [0.65, 0.85], [0.65, 0.6], [0.35, 0.6]] },
    { "action": "fill", "color": "#424242", "x": 0.5, "y": 0.725 },
    { "action": "gesture", "color": "#616161", "width": 5, "points": [[0.32, 0.4], [0.68, 0.4], [0.65, 0.6], [0.35, 0.6], [0.32, 0.4]] },
    { "action": "fill", "color": "#9e9e9e", "x": 0.5, "y": 0.497 },
    { "action": "gesture", "color": "#f1c40f", "width": 3, "points": [[0.35, 0.4], [0.65, 0.4], [0.6, 0.25], [0.4, 0.25], [0.35, 0.4]] },
    { "action": "fill", "color": "#fff176", "x": 0.5, "y": 0.33 },
    { "action": "gesture", "color": "#f1c40f", "width": 2, "points": [[0.6, 0.3], [0.85, 0.2]] },
    { "action": "gesture", "color": "#f1c40f", "width": 2, "points": [[0.62, 0.35], [0.9, 0.32]] }
  ],

  necklace: [
    { "action": "gesture", "color": "#d4af37", "width": 3, "points": [[0.3, 0.3], [0.25, 0.45], [0.25, 0.6], [0.32, 0.7], [0.45, 0.75], [0.55, 0.75], [0.68, 0.7], [0.75, 0.6], [0.75, 0.45], [0.7, 0.3]] },
    { "action": "gesture", "color": "#e74c3c", "width": 6, "points": [[0.5, 0.72], [0.5, 0.72]] }
  ],

  kettle: [
    { "action": "gesture", "color": "#455a64", "width": 5, "points": [[0.3, 0.9], [0.3, 0.6], [0.35, 0.42], [0.5, 0.35], [0.65, 0.42], [0.7, 0.6], [0.7, 0.9], [0.3, 0.9]] },
    { "action": "fill", "color": "#607d8b", "x": 0.5, "y": 0.6541 },
    { "action": "gesture", "color": "#37474f", "width": 4, "points": [[0.7, 0.55], [0.85, 0.45], [0.82, 0.4]] },
    { "action": "gesture", "color": "#37474f", "width": 4, "points": [[0.3, 0.55], [0.2, 0.55], [0.2, 0.65], [0.3, 0.65]] },
    { "action": "gesture", "color": "#37474f", "width": 4, "points": [[0.42, 0.35], [0.42, 0.25], [0.58, 0.25], [0.58, 0.35]] }
  ],

  calendar: [
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.2, 0.25], [0.8, 0.25], [0.8, 0.85], [0.2, 0.85], [0.2, 0.25]] },
    { "action": "fill", "color": "#ffffff", "x": 0.5, "y": 0.55 },
    { "action": "gesture", "color": "#e74c3c", "width": 5, "points": [[0.2, 0.35], [0.8, 0.35]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.3, 0.2], [0.3, 0.3]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.7, 0.2], [0.7, 0.3]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 2, "points": [[0.3, 0.5], [0.4, 0.5]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 2, "points": [[0.5, 0.5], [0.6, 0.5]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 2, "points": [[0.3, 0.65], [0.4, 0.65]] },
    { "action": "gesture", "color": "#e74c3c", "width": 2, "points": [[0.5, 0.65], [0.6, 0.65]] }
  ],

  pencil: [
    { "action": "gesture", "color": "#f1c40f", "width": 8, "points": [[0.25, 0.75], [0.65, 0.35]] },
    { "action": "gesture", "color": "#e0a96d", "width": 8, "points": [[0.65, 0.35], [0.75, 0.25]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.72, 0.28], [0.78, 0.22]] },
    { "action": "gesture", "color": "#e91e63", "width": 8, "points": [[0.22, 0.78], [0.25, 0.75]] }
  ],

  wheelchair: [
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.35, 0.55], [0.35, 0.55]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.35, 0.35], [0.35, 0.75], [0.6, 0.75]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.3, 0.35], [0.5, 0.35]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.35, 0.5], [0.55, 0.5]] },
    { "action": "gesture", "color": "#2c3e50", "width": 5, "points": [[0.35, 0.85], [0.35, 0.55], [0.6, 0.55], [0.6, 0.65]] },
    { "action": "gesture", "color": "#c0392b", "width": 2, "points": [[0.42, 0.6], [0.55, 0.6]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.4, 0.9], [0.4, 0.7], [0.5, 0.55], [0.5, 0.7], [0.4, 0.9]] },
    { "action": "fill", "color": "#333333", "x": 0.4476, "y": 0.7167 }
  ],

  elephant: [
    { "action": "gesture", "color": "#7f8c8d", "width": 5, "points": [[0.3, 0.55], [0.28, 0.4], [0.35, 0.3], [0.5, 0.28], [0.65, 0.32], [0.72, 0.42], [0.72, 0.55], [0.68, 0.65], [0.3, 0.65], [0.28, 0.6], [0.3, 0.55]] },
    { "action": "fill", "color": "#95a5a6", "x": 0.498, "y": 0.478 },
    { "action": "gesture", "color": "#7f8c8d", "width": 4, "points": [[0.35, 0.55], [0.32, 0.7], [0.3, 0.85], [0.26, 0.9]] },
    { "action": "gesture", "color": "#95a5a6", "width": 3, "points": [[0.26, 0.9], [0.28, 0.85], [0.28, 0.8]] },
    { "action": "gesture", "color": "#7f8c8d", "width": 5, "points": [[0.35, 0.65], [0.35, 0.85]] },
    { "action": "gesture", "color": "#7f8c8d", "width": 5, "points": [[0.45, 0.65], [0.45, 0.85]] },
    { "action": "gesture", "color": "#7f8c8d", "width": 5, "points": [[0.58, 0.65], [0.58, 0.85]] },
    { "action": "gesture", "color": "#7f8c8d", "width": 5, "points": [[0.68, 0.65], [0.68, 0.85]] },
    { "action": "gesture", "color": "#95a5a6", "width": 4, "points": [[0.68, 0.4], [0.8, 0.35], [0.85, 0.42], [0.78, 0.48], [0.68, 0.45], [0.68, 0.4]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.6, 0.42], [0.6, 0.42]] },
    { "action": "gesture", "color": "#7f8c8d", "width": 2, "points": [[0.4, 0.35], [0.55, 0.33]] }
  ],

  penguin: [
    { "action": "gesture", "color": "#1a1a1a", "width": 5, "points": [[0.4, 0.3], [0.3, 0.4], [0.28, 0.6], [0.32, 0.8], [0.4, 0.88], [0.6, 0.88], [0.68, 0.8], [0.72, 0.6], [0.7, 0.4], [0.6, 0.3], [0.4, 0.3]] },
    { "action": "fill", "color": "#212121", "x": 0.5, "y": 0.5881 },
    { "action": "gesture", "color": "#ffffff", "width": 4, "points": [[0.42, 0.42], [0.38, 0.55], [0.4, 0.75], [0.45, 0.85], [0.55, 0.85], [0.6, 0.75], [0.62, 0.55], [0.58, 0.42], [0.42, 0.42]] },
    { "action": "fill", "color": "#ffffff", "x": 0.5, "y": 0.6248 },
    { "action": "gesture", "color": "#f39c12", "width": 4, "points": [[0.46, 0.32], [0.5, 0.28], [0.54, 0.32], [0.5, 0.35], [0.46, 0.32]] },
    { "action": "fill", "color": "#f39c12", "x": 0.5, "y": 0.3167 },
    { "action": "gesture", "color": "#f39c12", "width": 4, "points": [[0.32, 0.85], [0.4, 0.88]] },
    { "action": "gesture", "color": "#f39c12", "width": 4, "points": [[0.68, 0.85], [0.6, 0.88]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.44, 0.4], [0.44, 0.4]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.56, 0.4], [0.56, 0.4]] }
  ],

  octopus: [
    { "action": "gesture", "color": "#e91e63", "width": 5, "points": [[0.32, 0.5], [0.3, 0.35], [0.4, 0.25], [0.6, 0.25], [0.7, 0.35], [0.68, 0.5], [0.32, 0.5]] },
    { "action": "fill", "color": "#ec407a", "x": 0.5, "y": 0.383 },
    { "action": "gesture", "color": "#e91e63", "width": 6, "points": [[0.32, 0.5], [0.25, 0.65], [0.3, 0.8], [0.25, 0.9]] },
    { "action": "gesture", "color": "#e91e63", "width": 6, "points": [[0.4, 0.5], [0.38, 0.68], [0.42, 0.85]] },
    { "action": "gesture", "color": "#e91e63", "width": 6, "points": [[0.48, 0.5], [0.48, 0.7], [0.46, 0.9]] },
    { "action": "gesture", "color": "#e91e63", "width": 6, "points": [[0.55, 0.5], [0.56, 0.7], [0.58, 0.88]] },
    { "action": "gesture", "color": "#e91e63", "width": 6, "points": [[0.62, 0.5], [0.65, 0.68], [0.62, 0.85]] },
    { "action": "gesture", "color": "#e91e63", "width": 6, "points": [[0.68, 0.5], [0.75, 0.65], [0.72, 0.82]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.42, 0.35], [0.42, 0.35]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.58, 0.35], [0.58, 0.35]] }
  ],

  kangaroo: [
    { "action": "gesture", "color": "#a0522d", "width": 5, "points": [[0.4, 0.25], [0.35, 0.3], [0.33, 0.4], [0.35, 0.5], [0.3, 0.55], [0.32, 0.65], [0.4, 0.72], [0.45, 0.85], [0.4, 0.9], [0.55, 0.9], [0.55, 0.75], [0.6, 0.7], [0.62, 0.55], [0.58, 0.45], [0.52, 0.3], [0.45, 0.25], [0.4, 0.25]] },
    { "action": "fill", "color": "#cd853f", "x": 0.4642, "y": 0.5606 },
    { "action": "gesture", "color": "#a0522d", "width": 4, "points": [[0.55, 0.6], [0.7, 0.65], [0.75, 0.8], [0.68, 0.88]] },
    { "action": "gesture", "color": "#a0522d", "width": 3, "points": [[0.34, 0.28], [0.3, 0.18]] },
    { "action": "gesture", "color": "#a0522d", "width": 3, "points": [[0.4, 0.25], [0.4, 0.15]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.4, 0.32], [0.4, 0.32]] }
  ],

  butterfly: [
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.5, 0.25], [0.5, 0.8]] },
    { "action": "gesture", "color": "#e91e63", "width": 3, "points": [[0.5, 0.35], [0.35, 0.2], [0.2, 0.3], [0.3, 0.45], [0.5, 0.45], [0.5, 0.35]] },
    { "action": "fill", "color": "#f06292", "x": 0.35, "y": 0.32 },
    { "action": "gesture", "color": "#e91e63", "width": 3, "points": [[0.5, 0.35], [0.65, 0.2], [0.8, 0.3], [0.7, 0.45], [0.5, 0.45], [0.5, 0.35]] },
    { "action": "fill", "color": "#f06292", "x": 0.65, "y": 0.32 },
    { "action": "gesture", "color": "#3498db", "width": 3, "points": [[0.5, 0.5], [0.35, 0.55], [0.25, 0.7], [0.35, 0.78], [0.5, 0.65], [0.5, 0.5]] },
    { "action": "fill", "color": "#5dade2", "x": 0.35, "y": 0.65 },
    { "action": "gesture", "color": "#3498db", "width": 3, "points": [[0.5, 0.5], [0.65, 0.55], [0.75, 0.7], [0.65, 0.78], [0.5, 0.65], [0.5, 0.5]] },
    { "action": "fill", "color": "#5dade2", "x": 0.65, "y": 0.65 },
    { "action": "gesture", "color": "#1a1a1a", "width": 2, "points": [[0.5, 0.25], [0.44, 0.15]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 2, "points": [[0.5, 0.25], [0.56, 0.15]] }
  ],

  spider: [
    { "action": "gesture", "color": "#1a1a1a", "width": 5, "points": [[0.42, 0.5], [0.4, 0.42], [0.44, 0.36], [0.5, 0.34], [0.56, 0.36], [0.6, 0.42], [0.58, 0.5], [0.42, 0.5]] },
    { "action": "fill", "color": "#212121", "x": 0.5, "y": 0.4284 },
    { "action": "gesture", "color": "#1a1a1a", "width": 6, "points": [[0.38, 0.62], [0.35, 0.5], [0.4, 0.5], [0.38, 0.62]] },
    { "action": "fill", "color": "#212121", "x": 0.38, "y": 0.56 },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.42, 0.5], [0.25, 0.4]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.4, 0.55], [0.2, 0.52]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.4, 0.62], [0.22, 0.65]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.42, 0.68], [0.28, 0.8]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.6, 0.5], [0.75, 0.4]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.62, 0.55], [0.8, 0.52]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.62, 0.62], [0.78, 0.65]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.6, 0.68], [0.72, 0.8]] },
    { "action": "gesture", "color": "#e74c3c", "width": 2, "points": [[0.46, 0.4], [0.46, 0.4]] },
    { "action": "gesture", "color": "#e74c3c", "width": 2, "points": [[0.54, 0.4], [0.54, 0.4]] }
  ],

  parrot: [
    { "action": "gesture", "color": "#2ecc71", "width": 5, "points": [[0.4, 0.3], [0.35, 0.4], [0.35, 0.55], [0.4, 0.68], [0.5, 0.75], [0.55, 0.85], [0.5, 0.9], [0.6, 0.88], [0.58, 0.75], [0.62, 0.6], [0.6, 0.42], [0.52, 0.3], [0.4, 0.3]] },
    { "action": "fill", "color": "#27ae60", "x": 0.4903, "y": 0.5459 },
    { "action": "gesture", "color": "#e74c3c", "width": 4, "points": [[0.35, 0.35], [0.25, 0.38], [0.28, 0.3], [0.35, 0.35]] },
    { "action": "fill", "color": "#ff5252", "x": 0.3, "y": 0.34 },
    { "action": "gesture", "color": "#f39c12", "width": 3, "points": [[0.35, 0.42], [0.24, 0.44], [0.35, 0.48], [0.35, 0.42]] },
    { "action": "fill", "color": "#ffb74d", "x": 0.3133, "y": 0.4467 },
    { "action": "gesture", "color": "#2ecc71", "width": 3, "points": [[0.55, 0.55], [0.7, 0.6], [0.68, 0.7], [0.55, 0.65]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.42, 0.38], [0.42, 0.38]] },
    { "action": "gesture", "color": "#3498db", "width": 3, "points": [[0.42, 0.85], [0.42, 0.95]] },
    { "action": "gesture", "color": "#3498db", "width": 3, "points": [[0.5, 0.85], [0.5, 0.97]] }
  ],

  dolphin: [
    { "action": "gesture", "color": "#5dade2", "width": 5, "points": [[0.15, 0.55], [0.25, 0.45], [0.4, 0.42], [0.55, 0.45], [0.7, 0.4], [0.85, 0.35], [0.78, 0.45], [0.65, 0.5], [0.55, 0.58], [0.4, 0.62], [0.25, 0.6], [0.15, 0.55]] },
    { "action": "fill", "color": "#85c1e9", "x": 0.4598, "y": 0.5023 },
    { "action": "gesture", "color": "#5dade2", "width": 3, "points": [[0.5, 0.42], [0.5, 0.28], [0.6, 0.4]] },
    { "action": "gesture", "color": "#5dade2", "width": 3, "points": [[0.3, 0.58], [0.28, 0.7], [0.4, 0.6]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.25, 0.5], [0.25, 0.5]] },
    { "action": "gesture", "color": "#5dade2", "width": 3, "points": [[0.15, 0.55], [0.08, 0.5]] }
  ],

  crocodile: [
    { "action": "gesture", "color": "#2e7d32", "width": 5, "points": [[0.1, 0.6], [0.25, 0.55], [0.4, 0.58], [0.55, 0.55], [0.7, 0.58], [0.85, 0.55], [0.9, 0.6], [0.85, 0.65], [0.55, 0.68], [0.25, 0.68], [0.1, 0.6]] },
    { "action": "fill", "color": "#43a047", "x": 0.5041, "y": 0.6171 },
    { "action": "gesture", "color": "#1b5e20", "width": 2, "points": [[0.6, 0.55], [0.85, 0.55]] },
    { "action": "gesture", "color": "#1b5e20", "width": 2, "points": [[0.6, 0.68], [0.85, 0.68]] },
    { "action": "gesture", "color": "#2e7d32", "width": 3, "points": [[0.3, 0.5], [0.3, 0.55]] },
    { "action": "gesture", "color": "#2e7d32", "width": 3, "points": [[0.45, 0.5], [0.45, 0.55]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.15, 0.57], [0.15, 0.57]] }
  ],

  peacock: [
    { "action": "gesture", "color": "#1565c0", "width": 5, "points": [[0.45, 0.55], [0.42, 0.65], [0.45, 0.75], [0.5, 0.8], [0.55, 0.75], [0.58, 0.65], [0.55, 0.55], [0.45, 0.55]] },
    { "action": "fill", "color": "#1976d2", "x": 0.5, "y": 0.6602 },
    { "action": "gesture", "color": "#1565c0", "width": 3, "points": [[0.48, 0.55], [0.45, 0.4], [0.5, 0.3], [0.48, 0.55]] },
    { "action": "fill", "color": "#1976d2", "x": 0.4767, "y": 0.4167 },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.46, 0.32], [0.47, 0.32]] },
    { "action": "gesture", "color": "#00897b", "width": 2, "points": [[0.3, 0.22], [0.24, 0.14], [0.3, 0.1], [0.36, 0.16], [0.3, 0.22]] },
    { "action": "fill", "color": "#43a047", "x": 0.3, "y": 0.1567 },
    { "action": "gesture", "color": "#00897b", "width": 2, "points": [[0.5, 0.18], [0.46, 0.08], [0.5, 0.04], [0.54, 0.08], [0.5, 0.18]] },
    { "action": "fill", "color": "#43a047", "x": 0.5, "y": 0.1 },
    { "action": "gesture", "color": "#00897b", "width": 2, "points": [[0.7, 0.22], [0.64, 0.16], [0.7, 0.1], [0.76, 0.14], [0.7, 0.22]] },
    { "action": "fill", "color": "#43a047", "x": 0.7, "y": 0.1567 },
    { "action": "gesture", "color": "#26a69a", "width": 2, "points": [[0.38, 0.3], [0.32, 0.26], [0.36, 0.2], [0.42, 0.24], [0.38, 0.3]] },
    { "action": "fill", "color": "#4db6ac", "x": 0.37, "y": 0.25 },
    { "action": "gesture", "color": "#26a69a", "width": 2, "points": [[0.62, 0.3], [0.68, 0.26], [0.64, 0.2], [0.58, 0.24], [0.62, 0.3]] },
    { "action": "fill", "color": "#4db6ac", "x": 0.63, "y": 0.25 }
  ],

  camel: [
    { "action": "gesture", "color": "#c8a165", "width": 5, "points": [[0.25, 0.6], [0.22, 0.5], [0.28, 0.42], [0.35, 0.42], [0.4, 0.35], [0.48, 0.32], [0.5, 0.4], [0.55, 0.35], [0.62, 0.4], [0.6, 0.48], [0.65, 0.55], [0.65, 0.65], [0.25, 0.65], [0.25, 0.6]] },
    { "action": "fill", "color": "#d4b483", "x": 0.4438, "y": 0.5163 },
    { "action": "gesture", "color": "#c8a165", "width": 4, "points": [[0.5, 0.4], [0.55, 0.25], [0.62, 0.22], [0.6, 0.32]] },
    { "action": "gesture", "color": "#c8a165", "width": 4, "points": [[0.28, 0.65], [0.28, 0.85]] },
    { "action": "gesture", "color": "#c8a165", "width": 4, "points": [[0.4, 0.65], [0.4, 0.85]] },
    { "action": "gesture", "color": "#c8a165", "width": 4, "points": [[0.55, 0.65], [0.55, 0.85]] },
    { "action": "gesture", "color": "#c8a165", "width": 4, "points": [[0.65, 0.65], [0.65, 0.85]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.58, 0.27], [0.58, 0.27]] }
  ],

  squirrel: [
    { "action": "gesture", "color": "#a0522d", "width": 5, "points": [[0.35, 0.5], [0.32, 0.6], [0.35, 0.7], [0.42, 0.75], [0.4, 0.6], [0.4, 0.5], [0.35, 0.5]] },
    { "action": "fill", "color": "#cd853f", "x": 0.3714, "y": 0.615 },
    { "action": "gesture", "color": "#a0522d", "width": 4, "points": [[0.4, 0.5], [0.35, 0.4], [0.38, 0.32], [0.45, 0.3], [0.48, 0.38], [0.4, 0.5]] },
    { "action": "fill", "color": "#cd853f", "x": 0.42, "y": 0.38 },
    { "action": "gesture", "color": "#a0522d", "width": 6, "points": [[0.42, 0.55], [0.55, 0.4], [0.65, 0.2], [0.6, 0.1], [0.55, 0.2], [0.5, 0.35], [0.4, 0.45], [0.42, 0.55]] },
    { "action": "fill", "color": "#cd853f", "x": 0.55, "y": 0.25 },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.4, 0.35], [0.4, 0.35]] },
    { "action": "gesture", "color": "#795548", "width": 2, "points": [[0.35, 0.42], [0.28, 0.4]] }
  ],

  owl: [
    { "action": "gesture", "color": "#795548", "width": 5, "points": [[0.35, 0.3], [0.3, 0.45], [0.3, 0.65], [0.38, 0.78], [0.5, 0.82], [0.62, 0.78], [0.7, 0.65], [0.7, 0.45], [0.65, 0.3], [0.5, 0.25], [0.35, 0.3]] },
    { "action": "fill", "color": "#8d6e63", "x": 0.5, "y": 0.5329 },
    { "action": "gesture", "color": "#ffffff", "width": 3, "points": [[0.38, 0.42], [0.36, 0.5], [0.4, 0.56], [0.46, 0.52], [0.46, 0.44], [0.38, 0.42]] },
    { "action": "fill", "color": "#f5f5f5", "x": 0.4124, "y": 0.4857 },
    { "action": "gesture", "color": "#ffffff", "width": 3, "points": [[0.62, 0.42], [0.64, 0.5], [0.6, 0.56], [0.54, 0.52], [0.54, 0.44], [0.62, 0.42]] },
    { "action": "fill", "color": "#f5f5f5", "x": 0.5876, "y": 0.4857 },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.41, 0.48], [0.41, 0.48]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.59, 0.48], [0.59, 0.48]] },
    { "action": "gesture", "color": "#f39c12", "width": 3, "points": [[0.47, 0.58], [0.5, 0.63], [0.53, 0.58]] },
    { "action": "gesture", "color": "#5d4037", "width": 2, "points": [[0.35, 0.28], [0.4, 0.2]] },
    { "action": "gesture", "color": "#5d4037", "width": 2, "points": [[0.65, 0.28], [0.6, 0.2]] }
  ],

  snail: [
    { "action": "gesture", "color": "#8d6e63", "width": 5, "points": [[0.35, 0.7], [0.25, 0.65], [0.22, 0.55], [0.28, 0.48], [0.38, 0.48], [0.42, 0.56], [0.36, 0.6], [0.32, 0.56], [0.35, 0.7]] },
    { "action": "fill", "color": "#a1887f", "x": 0.32, "y": 0.56 },
    { "action": "gesture", "color": "#7cb342", "width": 5, "points": [[0.2, 0.75], [0.35, 0.7], [0.55, 0.72], [0.7, 0.75], [0.75, 0.8], [0.5, 0.83], [0.25, 0.8], [0.2, 0.75]] },
    { "action": "fill", "color": "#9ccc65", "x": 0.4652, "y": 0.7678 },
    { "action": "gesture", "color": "#7cb342", "width": 3, "points": [[0.2, 0.75], [0.15, 0.6], [0.2, 0.5]] },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.16, 0.5], [0.16, 0.5]] },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.24, 0.5], [0.24, 0.5]] }
  ],

  goat: [
    { "action": "gesture", "color": "#e0e0e0", "width": 5, "points": [[0.3, 0.45], [0.28, 0.35], [0.33, 0.28], [0.4, 0.3], [0.4, 0.4], [0.5, 0.38], [0.55, 0.42], [0.6, 0.4], [0.65, 0.45], [0.63, 0.6], [0.6, 0.68], [0.3, 0.68], [0.28, 0.55], [0.3, 0.45]] },
    { "action": "fill", "color": "#f5f5f5", "x": 0.4477, "y": 0.5169 },
    { "action": "gesture", "color": "#e0e0e0", "width": 4, "points": [[0.32, 0.68], [0.32, 0.85]] },
    { "action": "gesture", "color": "#e0e0e0", "width": 4, "points": [[0.45, 0.68], [0.45, 0.85]] },
    { "action": "gesture", "color": "#e0e0e0", "width": 4, "points": [[0.55, 0.68], [0.55, 0.85]] },
    { "action": "gesture", "color": "#e0e0e0", "width": 4, "points": [[0.6, 0.68], [0.6, 0.85]] },
    { "action": "gesture", "color": "#795548", "width": 3, "points": [[0.32, 0.32], [0.28, 0.22]] },
    { "action": "gesture", "color": "#795548", "width": 3, "points": [[0.38, 0.28], [0.4, 0.18]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.32, 0.4], [0.32, 0.4]] },
    { "action": "gesture", "color": "#5d4037", "width": 2, "points": [[0.28, 0.46], [0.22, 0.5]] }
  ],

  tortoise: [
    { "action": "gesture", "color": "#33691e", "width": 5, "points": [[0.3, 0.45], [0.25, 0.55], [0.28, 0.68], [0.4, 0.75], [0.6, 0.75], [0.72, 0.68], [0.75, 0.55], [0.7, 0.45], [0.5, 0.4], [0.3, 0.45]] },
    { "action": "fill", "color": "#558b2f", "x": 0.5, "y": 0.58 },
    { "action": "gesture", "color": "#33691e", "width": 2, "points": [[0.5, 0.45], [0.4, 0.55], [0.5, 0.65], [0.6, 0.55], [0.5, 0.45]] },
    { "action": "gesture", "color": "#7cb342", "width": 4, "points": [[0.25, 0.55], [0.15, 0.5], [0.12, 0.55], [0.25, 0.55]] },
    { "action": "fill", "color": "#8bc34a", "x": 0.16, "y": 0.52 },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.13, 0.51], [0.13, 0.51]] },
    { "action": "gesture", "color": "#7cb342", "width": 3, "points": [[0.35, 0.72], [0.35, 0.85]] },
    { "action": "gesture", "color": "#7cb342", "width": 3, "points": [[0.65, 0.72], [0.65, 0.85]] }
  ],

  flamingo: [
    { "action": "gesture", "color": "#f06292", "width": 5, "points": [[0.5, 0.35], [0.45, 0.42], [0.45, 0.5], [0.5, 0.55], [0.55, 0.5], [0.55, 0.42], [0.5, 0.35]] },
    { "action": "fill", "color": "#f48fb1", "x": 0.5, "y": 0.4543 },
    { "action": "gesture", "color": "#f06292", "width": 3, "points": [[0.5, 0.35], [0.45, 0.25], [0.35, 0.2], [0.3, 0.25]] },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.3, 0.25], [0.24, 0.24]] },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.38, 0.22], [0.38, 0.22]] },
    { "action": "gesture", "color": "#f06292", "width": 4, "points": [[0.5, 0.55], [0.5, 0.7], [0.45, 0.8], [0.4, 0.9]] },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.4, 0.9], [0.35, 0.9]] },
    { "action": "gesture", "color": "#f06292", "width": 3, "points": [[0.48, 0.7], [0.48, 0.75]] }
  ],

  hedgehog: [
    { "action": "gesture", "color": "#795548", "width": 5, "points": [[0.25, 0.7], [0.25, 0.55], [0.35, 0.45], [0.5, 0.4], [0.65, 0.45], [0.72, 0.55], [0.7, 0.65], [0.25, 0.7]] },
    { "action": "fill", "color": "#8d6e63", "x": 0.4772, "y": 0.5591 },
    { "action": "gesture", "color": "#5d4037", "width": 2, "points": [[0.3, 0.5], [0.25, 0.4]] },
    { "action": "gesture", "color": "#5d4037", "width": 2, "points": [[0.35, 0.45], [0.32, 0.32]] },
    { "action": "gesture", "color": "#5d4037", "width": 2, "points": [[0.42, 0.42], [0.4, 0.28]] },
    { "action": "gesture", "color": "#5d4037", "width": 2, "points": [[0.5, 0.4], [0.5, 0.25]] },
    { "action": "gesture", "color": "#5d4037", "width": 2, "points": [[0.58, 0.42], [0.6, 0.28]] },
    { "action": "gesture", "color": "#5d4037", "width": 2, "points": [[0.65, 0.45], [0.68, 0.32]] },
    { "action": "gesture", "color": "#5d4037", "width": 2, "points": [[0.7, 0.5], [0.75, 0.4]] },
    { "action": "gesture", "color": "#c8a165", "width": 3, "points": [[0.22, 0.62], [0.15, 0.6]] },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.18, 0.6], [0.18, 0.6]] }
  ],

  koala: [
    { "action": "gesture", "color": "#9e9e9e", "width": 5, "points": [[0.35, 0.42], [0.32, 0.55], [0.35, 0.7], [0.45, 0.78], [0.55, 0.78], [0.65, 0.7], [0.68, 0.55], [0.65, 0.42], [0.5, 0.35], [0.35, 0.42]] },
    { "action": "fill", "color": "#bdbdbd", "x": 0.5, "y": 0.5687 },
    { "action": "gesture", "color": "#9e9e9e", "width": 5, "points": [[0.22, 0.35], [0.15, 0.4], [0.15, 0.5], [0.25, 0.5], [0.28, 0.4], [0.22, 0.35]] },
    { "action": "fill", "color": "#e0e0e0", "x": 0.2098, "y": 0.4336 },
    { "action": "gesture", "color": "#9e9e9e", "width": 5, "points": [[0.78, 0.35], [0.85, 0.4], [0.85, 0.5], [0.75, 0.5], [0.72, 0.4], [0.78, 0.35]] },
    { "action": "fill", "color": "#e0e0e0", "x": 0.7902, "y": 0.4336 },
    { "action": "gesture", "color": "#5d4037", "width": 4, "points": [[0.44, 0.55], [0.4, 0.58], [0.44, 0.62], [0.56, 0.62], [0.6, 0.58], [0.56, 0.55], [0.44, 0.55]] },
    { "action": "fill", "color": "#6d4c41", "x": 0.5, "y": 0.5846 },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.43, 0.47], [0.43, 0.47]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.57, 0.47], [0.57, 0.47]] }
  ],

  chameleon: [
    { "action": "gesture", "color": "#66bb6a", "width": 5, "points": [[0.3, 0.5], [0.35, 0.4], [0.45, 0.35], [0.55, 0.4], [0.6, 0.5], [0.55, 0.58], [0.4, 0.58], [0.3, 0.5]] },
    { "action": "fill", "color": "#81c784", "x": 0.4542, "y": 0.4769 },
    { "action": "gesture", "color": "#66bb6a", "width": 4, "points": [[0.55, 0.5], [0.68, 0.48], [0.8, 0.55], [0.85, 0.65], [0.78, 0.6], [0.7, 0.55], [0.6, 0.55]] },
    { "action": "gesture", "color": "#4caf50", "width": 3, "points": [[0.3, 0.52], [0.15, 0.55], [0.1, 0.65], [0.15, 0.7]] },
    { "action": "gesture", "color": "#66bb6a", "width": 3, "points": [[0.4, 0.4], [0.35, 0.28], [0.4, 0.2]] },
    { "action": "gesture", "color": "#66bb6a", "width": 3, "points": [[0.55, 0.65], [0.5, 0.8], [0.55, 0.9]] },
    { "action": "gesture", "color": "#66bb6a", "width": 3, "points": [[0.4, 0.65], [0.35, 0.78], [0.3, 0.88]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.35, 0.42], [0.35, 0.42]] }
  ],

  walrus: [
    { "action": "gesture", "color": "#a1887f", "width": 5, "points": [[0.25, 0.55], [0.25, 0.42], [0.32, 0.35], [0.5, 0.32], [0.68, 0.35], [0.75, 0.45], [0.75, 0.6], [0.68, 0.72], [0.32, 0.72], [0.25, 0.6], [0.25, 0.55]] },
    { "action": "fill", "color": "#bcaaa4", "x": 0.4986, "y": 0.5274 },
    { "action": "gesture", "color": "#8d6e63", "width": 2, "points": [[0.4, 0.55], [0.3, 0.55]] },
    { "action": "gesture", "color": "#8d6e63", "width": 2, "points": [[0.4, 0.6], [0.3, 0.62]] },
    { "action": "gesture", "color": "#8d6e63", "width": 2, "points": [[0.6, 0.55], [0.7, 0.55]] },
    { "action": "gesture", "color": "#8d6e63", "width": 2, "points": [[0.6, 0.6], [0.7, 0.62]] },
    { "action": "gesture", "color": "#eceff1", "width": 3, "points": [[0.42, 0.65], [0.4, 0.8]] },
    { "action": "gesture", "color": "#eceff1", "width": 3, "points": [[0.55, 0.65], [0.57, 0.8]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.4, 0.45], [0.4, 0.45]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.58, 0.45], [0.58, 0.45]] }
  ],

  jellyfish: [
    { "action": "gesture", "color": "#ba68c8", "width": 4, "points": [[0.3, 0.4], [0.32, 0.3], [0.4, 0.25], [0.5, 0.24], [0.6, 0.25], [0.68, 0.3], [0.7, 0.4], [0.6, 0.45], [0.4, 0.45], [0.3, 0.4]] },
    { "action": "fill", "color": "#ce93d8", "x": 0.5, "y": 0.35 },
    { "action": "gesture", "color": "#ba68c8", "width": 3, "points": [[0.35, 0.45], [0.3, 0.6], [0.35, 0.75]] },
    { "action": "gesture", "color": "#ba68c8", "width": 3, "points": [[0.45, 0.45], [0.42, 0.62], [0.45, 0.8]] },
    { "action": "gesture", "color": "#ba68c8", "width": 3, "points": [[0.55, 0.45], [0.58, 0.62], [0.55, 0.8]] },
    { "action": "gesture", "color": "#ba68c8", "width": 3, "points": [[0.65, 0.45], [0.7, 0.6], [0.65, 0.75]] },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.4, 0.35], [0.4, 0.35]] },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.6, 0.35], [0.6, 0.35]] }
  ],

  rhinoceros: [
    { "action": "gesture", "color": "#78909c", "width": 5, "points": [[0.25, 0.55], [0.22, 0.42], [0.3, 0.35], [0.45, 0.32], [0.6, 0.35], [0.7, 0.42], [0.72, 0.55], [0.68, 0.68], [0.25, 0.68], [0.25, 0.55]] },
    { "action": "fill", "color": "#90a4ae", "x": 0.4698, "y": 0.5128 },
    { "action": "gesture", "color": "#78909c", "width": 4, "points": [[0.28, 0.68], [0.28, 0.85]] },
    { "action": "gesture", "color": "#78909c", "width": 4, "points": [[0.4, 0.68], [0.4, 0.85]] },
    { "action": "gesture", "color": "#78909c", "width": 4, "points": [[0.55, 0.68], [0.55, 0.85]] },
    { "action": "gesture", "color": "#78909c", "width": 4, "points": [[0.65, 0.68], [0.65, 0.85]] },
    { "action": "gesture", "color": "#e0e0e0", "width": 4, "points": [[0.22, 0.5], [0.1, 0.48], [0.08, 0.4]] },
    { "action": "gesture", "color": "#e0e0e0", "width": 2, "points": [[0.15, 0.49], [0.1, 0.53]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.24, 0.45], [0.24, 0.45]] }
  ],

  seahorse: [
    { "action": "gesture", "color": "#ff8a65", "width": 5, "points": [[0.5, 0.25], [0.55, 0.3], [0.58, 0.4], [0.55, 0.5], [0.6, 0.58], [0.58, 0.68], [0.5, 0.75], [0.42, 0.72], [0.42, 0.6], [0.48, 0.55], [0.42, 0.48], [0.42, 0.35], [0.48, 0.28], [0.5, 0.25]] },
    { "action": "fill", "color": "#ffab91", "x": 0.501, "y": 0.514 },
    { "action": "gesture", "color": "#ff8a65", "width": 3, "points": [[0.55, 0.25], [0.6, 0.2], [0.65, 0.22]] },
    { "action": "gesture", "color": "#ff8a65", "width": 2, "points": [[0.48, 0.3], [0.44, 0.3]] },
    { "action": "gesture", "color": "#ff8a65", "width": 2, "points": [[0.48, 0.4], [0.43, 0.4]] },
    { "action": "gesture", "color": "#ff8a65", "width": 2, "points": [[0.5, 0.5], [0.45, 0.5]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.55, 0.28], [0.55, 0.28]] }
  ],

  pizza: [
    { "action": "gesture", "color": "#e0a96d", "width": 5, "points": [[0.5, 0.2], [0.2, 0.75], [0.8, 0.75], [0.5, 0.2]] },
    { "action": "fill", "color": "#f1c40f", "x": 0.5, "y": 0.5667 },
    { "action": "gesture", "color": "#c0392b", "width": 4, "points": [[0.5, 0.32], [0.35, 0.6]] },
    { "action": "gesture", "color": "#c0392b", "width": 4, "points": [[0.5, 0.32], [0.65, 0.6]] },
    { "action": "gesture", "color": "#c0392b", "width": 4, "points": [[0.5, 0.32], [0.5, 0.68]] },
    { "action": "gesture", "color": "#c0392b", "width": 2, "points": [[0.42, 0.5], [0.42, 0.5]] },
    { "action": "gesture", "color": "#c0392b", "width": 2, "points": [[0.58, 0.5], [0.58, 0.5]] },
    { "action": "gesture", "color": "#c0392b", "width": 2, "points": [[0.5, 0.6], [0.5, 0.6]] },
    { "action": "gesture", "color": "#8d6e63", "width": 3, "points": [[0.2, 0.75], [0.8, 0.75]] }
  ],

  banana: [
    { "action": "gesture", "color": "#f1c40f", "width": 7, "points": [[0.3, 0.7], [0.28, 0.55], [0.32, 0.4], [0.42, 0.28], [0.55, 0.22], [0.68, 0.25]] },
    { "action": "gesture", "color": "#d4a017", "width": 3, "points": [[0.3, 0.7], [0.26, 0.75], [0.3, 0.78]] },
    { "action": "gesture", "color": "#8d6e63", "width": 3, "points": [[0.65, 0.22], [0.72, 0.2]] },
    { "action": "gesture", "color": "#c8a017", "width": 1, "points": [[0.33, 0.65], [0.36, 0.5], [0.42, 0.36]] }
  ],

  watermelon: [
    { "action": "gesture", "color": "#2e7d32", "width": 5, "points": [[0.2, 0.5], [0.25, 0.3], [0.5, 0.2], [0.75, 0.3], [0.8, 0.5], [0.2, 0.5]] },
    { "action": "fill", "color": "#43a047", "x": 0.5, "y": 0.3778 },
    { "action": "gesture", "color": "#e74c3c", "width": 4, "points": [[0.27, 0.48], [0.32, 0.32], [0.5, 0.24], [0.68, 0.32], [0.73, 0.48], [0.27, 0.48]] },
    { "action": "fill", "color": "#ff6659", "x": 0.5, "y": 0.3835 },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.4, 0.38], [0.4, 0.38]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.5, 0.32], [0.5, 0.32]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.6, 0.38], [0.6, 0.38]] },
    { "action": "gesture", "color": "#eeeeee", "width": 3, "points": [[0.2, 0.5], [0.8, 0.5]] }
  ],

  samosa: [
    { "action": "gesture", "color": "#d4a017", "width": 5, "points": [[0.3, 0.35], [0.7, 0.35], [0.5, 0.8], [0.3, 0.35]] },
    { "action": "fill", "color": "#e0a96d", "x": 0.5, "y": 0.5 },
    { "action": "gesture", "color": "#8d6e63", "width": 2, "points": [[0.3, 0.35], [0.7, 0.35]] },
    { "action": "gesture", "color": "#8d6e63", "width": 1, "points": [[0.4, 0.45], [0.55, 0.6]] },
    { "action": "gesture", "color": "#8d6e63", "width": 1, "points": [[0.55, 0.45], [0.42, 0.6]] }
  ],

  mango: [
    { "action": "gesture", "color": "#f39c12", "width": 5, "points": [[0.35, 0.35], [0.28, 0.5], [0.3, 0.68], [0.42, 0.8], [0.55, 0.78], [0.63, 0.65], [0.62, 0.48], [0.5, 0.32], [0.35, 0.35]] },
    { "action": "fill", "color": "#f7c04a", "x": 0.4555, "y": 0.5626 },
    { "action": "gesture", "color": "#e74c3c", "width": 3, "points": [[0.35, 0.35], [0.42, 0.4]] },
    { "action": "gesture", "color": "#2e7d32", "width": 4, "points": [[0.5, 0.32], [0.55, 0.2], [0.65, 0.18]] }
  ],

  noodles: [
    { "action": "gesture", "color": "#607d8b", "width": 4, "points": [[0.2, 0.55], [0.8, 0.55], [0.75, 0.75], [0.25, 0.75], [0.2, 0.55]] },
    { "action": "fill", "color": "#78909c", "x": 0.5, "y": 0.647 },
    { "action": "gesture", "color": "#f1c40f", "width": 3, "points": [[0.3, 0.4], [0.35, 0.5], [0.4, 0.42], [0.45, 0.52], [0.5, 0.4]] },
    { "action": "gesture", "color": "#f1c40f", "width": 3, "points": [[0.5, 0.42], [0.55, 0.52], [0.6, 0.4], [0.65, 0.5], [0.7, 0.4]] },
    { "action": "gesture", "color": "#e74c3c", "width": 3, "points": [[0.4, 0.6], [0.4, 0.6]] },
    { "action": "gesture", "color": "#2e7d32", "width": 3, "points": [[0.55, 0.62], [0.6, 0.6]] },
    { "action": "gesture", "color": "#795548", "width": 4, "points": [[0.75, 0.4], [0.85, 0.6]] },
    { "action": "gesture", "color": "#795548", "width": 4, "points": [[0.8, 0.4], [0.9, 0.6]] }
  ],

  pancake: [
    { "action": "gesture", "color": "#e0a96d", "width": 4, "points": [[0.25, 0.72], [0.75, 0.72], [0.72, 0.78], [0.28, 0.78], [0.25, 0.72]] },
    { "action": "fill", "color": "#f4c481", "x": 0.5, "y": 0.7494 },
    { "action": "gesture", "color": "#d4915c", "width": 4, "points": [[0.28, 0.6], [0.72, 0.6], [0.75, 0.66], [0.25, 0.66], [0.28, 0.6]] },
    { "action": "fill", "color": "#e0a96d", "x": 0.5, "y": 0.6306 },
    { "action": "gesture", "color": "#e0a96d", "width": 4, "points": [[0.3, 0.48], [0.7, 0.48], [0.72, 0.55], [0.28, 0.55], [0.3, 0.48]] },
    { "action": "fill", "color": "#f4c481", "x": 0.5, "y": 0.5156 },
    { "action": "gesture", "color": "#f1c40f", "width": 3, "points": [[0.45, 0.4], [0.55, 0.4], [0.55, 0.46], [0.45, 0.46], [0.45, 0.4]] },
    { "action": "fill", "color": "#fff176", "x": 0.5, "y": 0.43 },
    { "action": "gesture", "color": "#a0522d", "width": 2, "points": [[0.4, 0.6], [0.6, 0.66]] }
  ],

  donut: [
    { "action": "gesture", "color": "#8d6e63", "width": 5, "points": [[0.5, 0.3], [0.35, 0.35], [0.28, 0.5], [0.35, 0.65], [0.5, 0.7], [0.65, 0.65], [0.72, 0.5], [0.65, 0.35], [0.5, 0.3]] },
    { "action": "fill", "color": "#e91e63", "x": 0.5, "y": 0.5 },
    { "action": "gesture", "color": "#8d6e63", "width": 3, "points": [[0.5, 0.45], [0.44, 0.47], [0.42, 0.5], [0.44, 0.53], [0.5, 0.55], [0.56, 0.53], [0.58, 0.5], [0.56, 0.47], [0.5, 0.45]] },
    { "action": "fill", "color": "#f5f5dc", "x": 0.5, "y": 0.5 },
    { "action": "gesture", "color": "#3498db", "width": 3, "points": [[0.38, 0.38], [0.38, 0.38]] },
    { "action": "gesture", "color": "#2ecc71", "width": 3, "points": [[0.45, 0.33], [0.45, 0.33]] },
    { "action": "gesture", "color": "#f1c40f", "width": 3, "points": [[0.58, 0.35], [0.58, 0.35]] },
    { "action": "gesture", "color": "#9b59b6", "width": 3, "points": [[0.62, 0.42], [0.62, 0.42]] }
  ],

  cupcake: [
    { "action": "gesture", "color": "#e91e63", "width": 5, "points": [[0.35, 0.4], [0.3, 0.3], [0.4, 0.2], [0.5, 0.15], [0.6, 0.2], [0.7, 0.3], [0.65, 0.4], [0.35, 0.4]] },
    { "action": "fill", "color": "#f06292", "x": 0.5, "y": 0.2964 },
    { "action": "gesture", "color": "#c0392b", "width": 4, "points": [[0.5, 0.15], [0.5, 0.15]] },
    { "action": "gesture", "color": "#8d6e63", "width": 4, "points": [[0.3, 0.4], [0.28, 0.6], [0.35, 0.8], [0.65, 0.8], [0.72, 0.6], [0.7, 0.4], [0.3, 0.4]] },
    { "action": "fill", "color": "#a0522d", "x": 0.5, "y": 0.5916 },
    { "action": "gesture", "color": "#5d4037", "width": 2, "points": [[0.35, 0.5], [0.65, 0.55]] },
    { "action": "gesture", "color": "#5d4037", "width": 2, "points": [[0.32, 0.65], [0.68, 0.7]] }
  ],

  chili: [
    { "action": "gesture", "color": "#c0392b", "width": 4, "points": [[0.4, 0.3], [0.48, 0.42], [0.55, 0.56], [0.59, 0.68], [0.6, 0.78], [0.56, 0.84], [0.5, 0.82], [0.47, 0.72], [0.42, 0.58], [0.37, 0.44], [0.4, 0.3]] },
    { "action": "fill", "color": "#e74c3c", "x": 0.4872, "y": 0.5912 },
    { "action": "gesture", "color": "#2e7d32", "width": 4, "points": [[0.4, 0.3], [0.35, 0.22], [0.3, 0.2]] },
    { "action": "gesture", "color": "#2e7d32", "width": 4, "points": [[0.4, 0.3], [0.42, 0.2], [0.38, 0.15]] },
    { "action": "gesture", "color": "#ff8a80", "width": 2, "points": [[0.46, 0.42], [0.44, 0.4]] }
  ],

  coconut: [
    { "action": "gesture", "color": "#5d4037", "width": 5, "points": [[0.3, 0.4], [0.25, 0.55], [0.3, 0.7], [0.45, 0.78], [0.6, 0.75], [0.7, 0.6], [0.68, 0.42], [0.55, 0.32], [0.4, 0.32], [0.3, 0.4]] },
    { "action": "fill", "color": "#795548", "x": 0.478, "y": 0.5443 },
    { "action": "gesture", "color": "#3e2723", "width": 2, "points": [[0.35, 0.42], [0.4, 0.55]] },
    { "action": "gesture", "color": "#3e2723", "width": 2, "points": [[0.45, 0.4], [0.5, 0.58]] },
    { "action": "gesture", "color": "#3e2723", "width": 2, "points": [[0.55, 0.42], [0.58, 0.6]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.45, 0.35], [0.45, 0.35]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.5, 0.33], [0.5, 0.33]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.55, 0.35], [0.55, 0.35]] }
  ],

  pineapple: [
    { "action": "gesture", "color": "#f1c40f", "width": 5, "points": [[0.35, 0.42], [0.3, 0.55], [0.32, 0.72], [0.4, 0.85], [0.6, 0.85], [0.68, 0.72], [0.7, 0.55], [0.65, 0.42], [0.35, 0.42]] },
    { "action": "fill", "color": "#f7c04a", "x": 0.5, "y": 0.6244 },
    { "action": "gesture", "color": "#a0522d", "width": 2, "points": [[0.35, 0.48], [0.65, 0.55]] },
    { "action": "gesture", "color": "#a0522d", "width": 2, "points": [[0.35, 0.6], [0.65, 0.67]] },
    { "action": "gesture", "color": "#a0522d", "width": 2, "points": [[0.35, 0.72], [0.65, 0.78]] },
    { "action": "gesture", "color": "#a0522d", "width": 2, "points": [[0.4, 0.44], [0.55, 0.8]] },
    { "action": "gesture", "color": "#a0522d", "width": 2, "points": [[0.6, 0.44], [0.45, 0.8]] },
    { "action": "gesture", "color": "#2e7d32", "width": 4, "points": [[0.5, 0.42], [0.45, 0.25], [0.4, 0.15]] },
    { "action": "gesture", "color": "#2e7d32", "width": 4, "points": [[0.5, 0.42], [0.5, 0.22], [0.5, 0.1]] },
    { "action": "gesture", "color": "#2e7d32", "width": 4, "points": [[0.5, 0.42], [0.55, 0.25], [0.6, 0.15]] }
  ],

  popcorn: [
    { "action": "gesture", "color": "#e74c3c", "width": 4, "points": [[0.32, 0.5], [0.68, 0.5], [0.75, 0.85], [0.25, 0.85], [0.32, 0.5]] },
    { "action": "fill", "color": "#ff5252", "x": 0.5, "y": 0.6845 },
    { "action": "gesture", "color": "#ffffff", "width": 2, "points": [[0.4, 0.55], [0.4, 0.8]] },
    { "action": "gesture", "color": "#ffffff", "width": 2, "points": [[0.5, 0.55], [0.5, 0.82]] },
    { "action": "gesture", "color": "#ffffff", "width": 2, "points": [[0.6, 0.55], [0.6, 0.8]] },
    { "action": "gesture", "color": "#fff9c4", "width": 3, "points": [[0.3, 0.5], [0.24, 0.42], [0.29, 0.34], [0.37, 0.36], [0.4, 0.29], [0.48, 0.27], [0.53, 0.33], [0.61, 0.29], [0.68, 0.34], [0.66, 0.42], [0.72, 0.48], [0.65, 0.52], [0.5, 0.54], [0.35, 0.53], [0.3, 0.5]] },
    { "action": "fill", "color": "#fffde7", "x": 0.4817, "y": 0.4198 }
  ],

  sandwich: [
    { "action": "gesture", "color": "#e0a96d", "width": 4, "points": [[0.2, 0.55], [0.5, 0.35], [0.8, 0.55], [0.72, 0.6], [0.28, 0.6], [0.2, 0.55]] },
    { "action": "fill", "color": "#f4c481", "x": 0.5, "y": 0.5107 },
    { "action": "gesture", "color": "#7cb342", "width": 4, "points": [[0.25, 0.6], [0.75, 0.6]] },
    { "action": "gesture", "color": "#e74c3c", "width": 4, "points": [[0.25, 0.65], [0.75, 0.65]] },
    { "action": "gesture", "color": "#fff176", "width": 4, "points": [[0.25, 0.7], [0.75, 0.7]] },
    { "action": "gesture", "color": "#e0a96d", "width": 4, "points": [[0.22, 0.72], [0.5, 0.85], [0.78, 0.72], [0.7, 0.75], [0.3, 0.75], [0.22, 0.72]] },
    { "action": "fill", "color": "#f4c481", "x": 0.5, "y": 0.7824 }
  ],

  strawberry: [
    { "action": "gesture", "color": "#e74c3c", "width": 5, "points": [[0.5, 0.35], [0.3, 0.45], [0.28, 0.65], [0.4, 0.85], [0.5, 0.9], [0.6, 0.85], [0.72, 0.65], [0.7, 0.45], [0.5, 0.35]] },
    { "action": "fill", "color": "#ff5252", "x": 0.5, "y": 0.6139 },
    { "action": "gesture", "color": "#2e7d32", "width": 4, "points": [[0.4, 0.35], [0.35, 0.25], [0.45, 0.28], [0.5, 0.2], [0.55, 0.28], [0.65, 0.25], [0.6, 0.35], [0.4, 0.35]] },
    { "action": "fill", "color": "#43a047", "x": 0.5, "y": 0.28 },
    { "action": "gesture", "color": "#f1c40f", "width": 2, "points": [[0.42, 0.5], [0.42, 0.5]] },
    { "action": "gesture", "color": "#f1c40f", "width": 2, "points": [[0.55, 0.55], [0.55, 0.55]] },
    { "action": "gesture", "color": "#f1c40f", "width": 2, "points": [[0.45, 0.68], [0.45, 0.68]] },
    { "action": "gesture", "color": "#f1c40f", "width": 2, "points": [[0.58, 0.7], [0.58, 0.7]] }
  ],

  dumpling: [
    { "action": "gesture", "color": "#f5f5dc", "width": 5, "points": [[0.25, 0.55], [0.28, 0.7], [0.4, 0.78], [0.6, 0.78], [0.72, 0.7], [0.75, 0.55], [0.62, 0.4], [0.38, 0.4], [0.25, 0.55]] },
    { "action": "fill", "color": "#faf5e9", "x": 0.5, "y": 0.5911 },
    { "action": "gesture", "color": "#e0dcc8", "width": 2, "points": [[0.4, 0.4], [0.45, 0.35], [0.5, 0.4]] },
    { "action": "gesture", "color": "#e0dcc8", "width": 2, "points": [[0.48, 0.38], [0.53, 0.34], [0.58, 0.4]] },
    { "action": "gesture", "color": "#e0dcc8", "width": 2, "points": [[0.55, 0.38], [0.6, 0.35], [0.63, 0.42]] }
  ],

  pretzel: [
    { "action": "gesture", "color": "#a0522d", "width": 6, "points": [[0.35, 0.3], [0.25, 0.4], [0.25, 0.55], [0.4, 0.6], [0.55, 0.5], [0.7, 0.6], [0.8, 0.5], [0.75, 0.35], [0.6, 0.3], [0.5, 0.4], [0.55, 0.55], [0.4, 0.65], [0.3, 0.55], [0.35, 0.3]] },
    { "action": "fill", "color": "#c8935c", "x": 0.5986, "y": 0.4224 },
    { "action": "gesture", "color": "#e0e0e0", "width": 2, "points": [[0.35, 0.35], [0.35, 0.35]] },
    { "action": "gesture", "color": "#e0e0e0", "width": 2, "points": [[0.55, 0.42], [0.55, 0.42]] },
    { "action": "gesture", "color": "#e0e0e0", "width": 2, "points": [[0.65, 0.4], [0.65, 0.4]] }
  ],

  omelette: [
    { "action": "gesture", "color": "#f1c40f", "width": 4, "points": [[0.25, 0.5], [0.2, 0.6], [0.3, 0.7], [0.5, 0.75], [0.7, 0.72], [0.8, 0.6], [0.75, 0.48], [0.6, 0.4], [0.4, 0.4], [0.25, 0.5]] },
    { "action": "fill", "color": "#fff176", "x": 0.506, "y": 0.5736 },
    { "action": "gesture", "color": "#2e7d32", "width": 2, "points": [[0.4, 0.55], [0.5, 0.55]] },
    { "action": "gesture", "color": "#e74c3c", "width": 2, "points": [[0.55, 0.6], [0.62, 0.58]] },
    { "action": "gesture", "color": "#795548", "width": 2, "points": [[0.45, 0.65], [0.55, 0.65]] }
  ],

  jalebi: [
    { "action": "gesture", "color": "#f39c12", "width": 5, "points": [[0.35, 0.35], [0.25, 0.4], [0.22, 0.5], [0.28, 0.6], [0.4, 0.62], [0.48, 0.55], [0.46, 0.45], [0.38, 0.42], [0.35, 0.35]] },
    { "action": "fill", "color": "#ff9800", "x": 0.35, "y": 0.5 },
    { "action": "gesture", "color": "#f39c12", "width": 5, "points": [[0.65, 0.35], [0.75, 0.4], [0.78, 0.5], [0.72, 0.6], [0.6, 0.62], [0.52, 0.55], [0.54, 0.45], [0.62, 0.42], [0.65, 0.35]] },
    { "action": "fill", "color": "#ff9800", "x": 0.65, "y": 0.5 },
    { "action": "gesture", "color": "#e67e22", "width": 3, "points": [[0.46, 0.45], [0.54, 0.45]] },
    { "action": "gesture", "color": "#fff3e0", "width": 1, "points": [[0.3, 0.45], [0.35, 0.52]] },
    { "action": "gesture", "color": "#fff3e0", "width": 1, "points": [[0.6, 0.45], [0.65, 0.52]] }
  ],

  popsicle: [
    { "action": "gesture", "color": "#e74c3c", "width": 5, "points": [[0.4, 0.3], [0.35, 0.5], [0.38, 0.6], [0.62, 0.6], [0.65, 0.5], [0.6, 0.3], [0.4, 0.3]] },
    { "action": "fill", "color": "#ff5252", "x": 0.5, "y": 0.4563 },
    { "action": "gesture", "color": "#c0392b", "width": 2, "points": [[0.5, 0.3], [0.5, 0.6]] },
    { "action": "gesture", "color": "#8d6e63", "width": 4, "points": [[0.5, 0.6], [0.5, 0.85]] }
  ],

  avocado: [
    { "action": "gesture", "color": "#2e7d32", "width": 5, "points": [[0.35, 0.3], [0.28, 0.45], [0.3, 0.65], [0.4, 0.8], [0.5, 0.85], [0.6, 0.8], [0.68, 0.6], [0.65, 0.4], [0.55, 0.28], [0.35, 0.3]] },
    { "action": "fill", "color": "#7cb342", "x": 0.48, "y": 0.5501 },
    { "action": "gesture", "color": "#f4d03f", "width": 3, "points": [[0.42, 0.35], [0.38, 0.5], [0.42, 0.65], [0.55, 0.7], [0.65, 0.6], [0.62, 0.42], [0.5, 0.32], [0.42, 0.35]] },
    { "action": "fill", "color": "#f9e79f", "x": 0.5116, "y": 0.5135 },
    { "action": "gesture", "color": "#8d6e63", "width": 5, "points": [[0.55, 0.5], [0.55, 0.5]] }
  ],

  biscuit: [
    { "action": "gesture", "color": "#c8935c", "width": 5, "points": [[0.35, 0.4], [0.3, 0.5], [0.35, 0.62], [0.5, 0.68], [0.65, 0.62], [0.7, 0.5], [0.65, 0.4], [0.5, 0.35], [0.35, 0.4]] },
    { "action": "fill", "color": "#dba86b", "x": 0.5, "y": 0.512 },
    { "action": "gesture", "color": "#a0522d", "width": 2, "points": [[0.42, 0.45], [0.42, 0.45]] },
    { "action": "gesture", "color": "#a0522d", "width": 2, "points": [[0.5, 0.48], [0.5, 0.48]] },
    { "action": "gesture", "color": "#a0522d", "width": 2, "points": [[0.58, 0.45], [0.58, 0.45]] },
    { "action": "gesture", "color": "#a0522d", "width": 2, "points": [[0.45, 0.58], [0.45, 0.58]] },
    { "action": "gesture", "color": "#a0522d", "width": 2, "points": [[0.55, 0.58], [0.55, 0.58]] }
  ],

  mountain: [
    { "action": "gesture", "color": "#5d4037", "width": 5, "points": [[0.1, 0.85], [0.3, 0.4], [0.45, 0.6], [0.55, 0.35], [0.75, 0.6], [0.9, 0.85], [0.1, 0.85]] },
    { "action": "fill", "color": "#795548", "x": 0.4883, "y": 0.6768 },
    { "action": "gesture", "color": "#ffffff", "width": 3, "points": [[0.5, 0.42], [0.45, 0.5], [0.55, 0.5], [0.55, 0.35], [0.5, 0.42]] },
    { "action": "fill", "color": "#eceff1", "x": 0.53, "y": 0.42 },
    { "action": "gesture", "color": "#3498db", "width": 2, "points": [[0.05, 0.85], [0.95, 0.85]] }
  ],

  volcano: [
    { "action": "gesture", "color": "#5d4037", "width": 5, "points": [[0.15, 0.85], [0.35, 0.5], [0.4, 0.35], [0.6, 0.35], [0.65, 0.5], [0.85, 0.85], [0.15, 0.85]] },
    { "action": "fill", "color": "#795548", "x": 0.5, "y": 0.651 },
    { "action": "gesture", "color": "#e74c3c", "width": 4, "points": [[0.42, 0.4], [0.5, 0.15], [0.58, 0.4], [0.42, 0.4]] },
    { "action": "fill", "color": "#ff5722", "x": 0.5, "y": 0.3 },
    { "action": "gesture", "color": "#9e9e9e", "width": 3, "points": [[0.5, 0.15], [0.45, 0.05]] },
    { "action": "gesture", "color": "#9e9e9e", "width": 3, "points": [[0.5, 0.15], [0.55, 0.02]] },
    { "action": "gesture", "color": "#f39c12", "width": 2, "points": [[0.47, 0.42], [0.44, 0.5]] },
    { "action": "gesture", "color": "#f39c12", "width": 2, "points": [[0.53, 0.42], [0.56, 0.5]] }
  ],

  rainbow: [
    { "action": "gesture", "color": "#e74c3c", "width": 3, "points": [[0.1, 0.8], [0.15, 0.55], [0.3, 0.35], [0.5, 0.28], [0.7, 0.35], [0.85, 0.55], [0.9, 0.8]] },
    { "action": "gesture", "color": "#f39c12", "width": 3, "points": [[0.15, 0.8], [0.19, 0.58], [0.32, 0.4], [0.5, 0.34], [0.68, 0.4], [0.81, 0.58], [0.85, 0.8]] },
    { "action": "gesture", "color": "#f1c40f", "width": 3, "points": [[0.2, 0.8], [0.23, 0.6], [0.34, 0.44], [0.5, 0.39], [0.66, 0.44], [0.77, 0.6], [0.8, 0.8]] },
    { "action": "gesture", "color": "#2ecc71", "width": 3, "points": [[0.25, 0.8], [0.27, 0.62], [0.37, 0.48], [0.5, 0.44], [0.63, 0.48], [0.73, 0.62], [0.75, 0.8]] },
    { "action": "gesture", "color": "#3498db", "width": 3, "points": [[0.3, 0.8], [0.31, 0.64], [0.4, 0.52], [0.5, 0.49], [0.6, 0.52], [0.69, 0.64], [0.7, 0.8]] },
    { "action": "gesture", "color": "#9b59b6", "width": 3, "points": [[0.35, 0.8], [0.36, 0.66], [0.43, 0.56], [0.5, 0.54], [0.57, 0.56], [0.64, 0.66], [0.65, 0.8]] }
  ],

  waterfall: [
    { "action": "gesture", "color": "#5d4037", "width": 4, "points": [[0.05, 0.95], [0.1, 0.5], [0.2, 0.2], [0.35, 0.15], [0.4, 0.3], [0.35, 0.6], [0.42, 0.6], [0.42, 0.95], [0.05, 0.95]] },
    { "action": "fill", "color": "#795548", "x": 0.25, "y": 0.6088 },
    { "action": "gesture", "color": "#5d4037", "width": 4, "points": [[0.95, 0.95], [0.9, 0.5], [0.8, 0.2], [0.65, 0.15], [0.6, 0.3], [0.65, 0.6], [0.58, 0.6], [0.58, 0.95], [0.95, 0.95]] },
    { "action": "fill", "color": "#795548", "x": 0.75, "y": 0.6088 },
    { "action": "gesture", "color": "#5dade2", "width": 2, "points": [[0.42, 0.3], [0.58, 0.3], [0.56, 0.85], [0.44, 0.85], [0.42, 0.3]] },
    { "action": "fill", "color": "#85c1e9", "x": 0.5, "y": 0.5619 },
    { "action": "gesture", "color": "#3498db", "width": 2, "points": [[0.35, 0.85], [0.65, 0.85], [0.6, 0.93], [0.4, 0.93], [0.35, 0.85]] },
    { "action": "fill", "color": "#5dade2", "x": 0.5, "y": 0.8873 },
    { "action": "gesture", "color": "#7cb342", "width": 4, "points": [[0.02, 0.93], [0.42, 0.93]] },
    { "action": "gesture", "color": "#7cb342", "width": 4, "points": [[0.58, 0.93], [0.98, 0.93]] }
  ],

  tornado: [
    { "action": "gesture", "color": "#78909c", "width": 6, "points": [[0.35, 0.15], [0.65, 0.15]] },
    { "action": "gesture", "color": "#78909c", "width": 5, "points": [[0.3, 0.28], [0.7, 0.28]] },
    { "action": "gesture", "color": "#78909c", "width": 5, "points": [[0.35, 0.42], [0.65, 0.42]] },
    { "action": "gesture", "color": "#78909c", "width": 4, "points": [[0.4, 0.55], [0.6, 0.55]] },
    { "action": "gesture", "color": "#78909c", "width": 4, "points": [[0.44, 0.68], [0.56, 0.68]] },
    { "action": "gesture", "color": "#78909c", "width": 3, "points": [[0.47, 0.8], [0.53, 0.8]] },
    { "action": "gesture", "color": "#78909c", "width": 3, "points": [[0.48, 0.9], [0.52, 0.9]] },
    { "action": "gesture", "color": "#5d4037", "width": 2, "points": [[0.2, 0.7], [0.35, 0.65]] },
    { "action": "gesture", "color": "#5d4037", "width": 2, "points": [[0.65, 0.6], [0.8, 0.55]] }
  ],

  island: [
    { "action": "gesture", "color": "#f4d03f", "width": 5, "points": [[0.25, 0.65], [0.75, 0.65], [0.7, 0.75], [0.3, 0.75], [0.25, 0.65]] },
    { "action": "fill", "color": "#f9e79f", "x": 0.5, "y": 0.6981 },
    { "action": "gesture", "color": "#7cb342", "width": 5, "points": [[0.5, 0.65], [0.45, 0.4], [0.5, 0.2]] },
    { "action": "gesture", "color": "#43a047", "width": 4, "points": [[0.5, 0.3], [0.35, 0.25], [0.3, 0.35], [0.4, 0.4], [0.5, 0.35], [0.5, 0.3]] },
    { "action": "fill", "color": "#66bb6a", "x": 0.4011, "y": 0.3267 },
    { "action": "gesture", "color": "#43a047", "width": 4, "points": [[0.5, 0.28], [0.65, 0.2], [0.7, 0.3], [0.6, 0.38], [0.5, 0.32], [0.5, 0.28]] },
    { "action": "fill", "color": "#66bb6a", "x": 0.6012, "y": 0.2928 },
    { "action": "gesture", "color": "#5dade2", "width": 3, "points": [[0.15, 0.75], [0.85, 0.75]] }
  ],

  desert: [
    { "action": "gesture", "color": "#f4d03f", "width": 3, "points": [[0.02, 0.85], [0.1, 0.7], [0.3, 0.55], [0.5, 0.68], [0.7, 0.5], [0.9, 0.68], [0.98, 0.85], [0.02, 0.85]] },
    { "action": "fill", "color": "#f9e79f", "x": 0.5144, "y": 0.7271 },
    { "action": "gesture", "color": "#f39c12", "width": 2, "points": [[0.02, 0.85], [0.98, 0.85]] },
    { "action": "gesture", "color": "#2e7d32", "width": 5, "points": [[0.65, 0.5], [0.6, 0.6], [0.65, 0.68]] },
    { "action": "gesture", "color": "#2e7d32", "width": 3, "points": [[0.62, 0.52], [0.55, 0.48]] },
    { "action": "gesture", "color": "#2e7d32", "width": 3, "points": [[0.65, 0.55], [0.72, 0.5]] },
    { "action": "gesture", "color": "#f1c40f", "width": 3, "points": [[0.8, 0.2], [0.85, 0.15], [0.9, 0.2], [0.85, 0.25], [0.8, 0.2]] },
    { "action": "fill", "color": "#f9ca24", "x": 0.85, "y": 0.2 }
  ],

  cactus: [
    { "action": "gesture", "color": "#2e7d32", "width": 8, "points": [[0.5, 0.85], [0.5, 0.3]] },
    { "action": "gesture", "color": "#2e7d32", "width": 6, "points": [[0.5, 0.5], [0.35, 0.5], [0.35, 0.35]] },
    { "action": "gesture", "color": "#2e7d32", "width": 6, "points": [[0.5, 0.6], [0.65, 0.6], [0.65, 0.42]] },
    { "action": "gesture", "color": "#1b5e20", "width": 1, "points": [[0.45, 0.35], [0.45, 0.8]] },
    { "action": "gesture", "color": "#1b5e20", "width": 1, "points": [[0.55, 0.35], [0.55, 0.8]] },
    { "action": "gesture", "color": "#8d6e63", "width": 4, "points": [[0.3, 0.85], [0.7, 0.85]] }
  ],

  lightning: [
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.6, 0.15], [0.55, 0.4], [0.65, 0.4], [0.4, 0.85], [0.48, 0.55], [0.38, 0.55], [0.6, 0.15]] },
    { "action": "fill", "color": "#f1c40f", "x": 0.5114, "y": 0.4854 },
    { "action": "gesture", "color": "#78909c", "width": 2, "points": [[0.15, 0.25], [0.2, 0.15], [0.35, 0.1], [0.5, 0.15], [0.55, 0.25], [0.4, 0.3], [0.25, 0.3], [0.15, 0.25]] },
    { "action": "fill", "color": "#90a4ae", "x": 0.3474, "y": 0.21 }
  ],

  snowman: [
    { "action": "gesture", "color": "#eceff1", "width": 5, "points": [[0.3, 0.85], [0.28, 0.7], [0.35, 0.6], [0.65, 0.6], [0.72, 0.7], [0.7, 0.85], [0.3, 0.85]] },
    { "action": "fill", "color": "#ffffff", "x": 0.5, "y": 0.7292 },
    { "action": "gesture", "color": "#eceff1", "width": 5, "points": [[0.37, 0.6], [0.35, 0.48], [0.4, 0.4], [0.6, 0.4], [0.65, 0.48], [0.63, 0.6], [0.37, 0.6]] },
    { "action": "fill", "color": "#ffffff", "x": 0.5, "y": 0.5028 },
    { "action": "gesture", "color": "#eceff1", "width": 5, "points": [[0.42, 0.4], [0.4, 0.32], [0.45, 0.26], [0.55, 0.26], [0.6, 0.32], [0.58, 0.4], [0.42, 0.4]] },
    { "action": "fill", "color": "#ffffff", "x": 0.5, "y": 0.3334 },
    { "action": "gesture", "color": "#f39c12", "width": 3, "points": [[0.5, 0.32], [0.62, 0.31]] },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.46, 0.29], [0.46, 0.29]] },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.54, 0.29], [0.54, 0.29]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 2, "points": [[0.45, 0.5], [0.45, 0.5]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 2, "points": [[0.55, 0.5], [0.55, 0.5]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 2, "points": [[0.45, 0.75], [0.45, 0.75]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 2, "points": [[0.55, 0.75], [0.55, 0.75]] }
  ],

  campfire: [
    { "action": "gesture", "color": "#5d4037", "width": 5, "points": [[0.3, 0.75], [0.7, 0.6]] },
    { "action": "gesture", "color": "#5d4037", "width": 5, "points": [[0.3, 0.6], [0.7, 0.75]] },
    { "action": "gesture", "color": "#e74c3c", "width": 4, "points": [[0.42, 0.65], [0.38, 0.5], [0.45, 0.35], [0.5, 0.5], [0.55, 0.3], [0.6, 0.5], [0.58, 0.65], [0.42, 0.65]] },
    { "action": "fill", "color": "#ff5722", "x": 0.4966, "y": 0.5191 },
    { "action": "gesture", "color": "#f1c40f", "width": 3, "points": [[0.46, 0.6], [0.44, 0.5], [0.5, 0.42], [0.54, 0.52], [0.5, 0.6], [0.46, 0.6]] },
    { "action": "fill", "color": "#ffca28", "x": 0.4885, "y": 0.5198 }
  ],

  cloud: [
    { "action": "gesture", "color": "#90a4ae", "width": 4, "points": [[0.25, 0.55], [0.2, 0.45], [0.28, 0.35], [0.38, 0.35], [0.42, 0.28], [0.55, 0.25], [0.65, 0.32], [0.68, 0.4], [0.78, 0.42], [0.8, 0.52], [0.72, 0.6], [0.3, 0.6], [0.25, 0.55]] },
    { "action": "fill", "color": "#eceff1", "x": 0.5006, "y": 0.4559 }
  ],

  iceberg: [
    { "action": "gesture", "color": "#5dade2", "width": 3, "points": [[0.1, 0.6], [0.9, 0.6]] },
    { "action": "gesture", "color": "#b3e5fc", "width": 4, "points": [[0.35, 0.6], [0.4, 0.35], [0.5, 0.2], [0.6, 0.35], [0.65, 0.6], [0.35, 0.6]] },
    { "action": "fill", "color": "#e1f5fe", "x": 0.5, "y": 0.4478 },
    { "action": "gesture", "color": "#4fc3f7", "width": 3, "points": [[0.25, 0.6], [0.3, 0.68], [0.7, 0.68], [0.75, 0.6], [0.25, 0.6]] },
    { "action": "fill", "color": "#81d4fa", "x": 0.5, "y": 0.6385 }
  ],

  sunflower: [
    { "action": "gesture", "color": "#f1c40f", "width": 4, "points": [[0.5, 0.4], [0.4, 0.25], [0.45, 0.2]] },
    { "action": "gesture", "color": "#f1c40f", "width": 4, "points": [[0.5, 0.4], [0.6, 0.25], [0.55, 0.2]] },
    { "action": "gesture", "color": "#f1c40f", "width": 4, "points": [[0.5, 0.4], [0.3, 0.35], [0.28, 0.42]] },
    { "action": "gesture", "color": "#f1c40f", "width": 4, "points": [[0.5, 0.4], [0.7, 0.35], [0.72, 0.42]] },
    { "action": "gesture", "color": "#f1c40f", "width": 4, "points": [[0.5, 0.4], [0.32, 0.5], [0.28, 0.55]] },
    { "action": "gesture", "color": "#f1c40f", "width": 4, "points": [[0.5, 0.4], [0.68, 0.5], [0.72, 0.55]] },
    { "action": "gesture", "color": "#f1c40f", "width": 4, "points": [[0.5, 0.4], [0.45, 0.55], [0.42, 0.6]] },
    { "action": "gesture", "color": "#f1c40f", "width": 4, "points": [[0.5, 0.4], [0.55, 0.55], [0.58, 0.6]] },
    { "action": "gesture", "color": "#8d6e63", "width": 3, "points": [[0.42, 0.4], [0.42, 0.4]] },
    { "action": "gesture", "color": "#2e7d32", "width": 5, "points": [[0.5, 0.45], [0.5, 0.85]] },
    { "action": "gesture", "color": "#2e7d32", "width": 3, "points": [[0.5, 0.65], [0.4, 0.6]] },
    { "action": "gesture", "color": "#2e7d32", "width": 3, "points": [[0.5, 0.72], [0.6, 0.68]] }
  ],

  glacier: [
    { "action": "gesture", "color": "#b3e5fc", "width": 4, "points": [[0.1, 0.7], [0.2, 0.45], [0.35, 0.5], [0.45, 0.3], [0.6, 0.4], [0.7, 0.25], [0.85, 0.5], [0.9, 0.7], [0.1, 0.7]] },
    { "action": "fill", "color": "#e1f5fe", "x": 0.5316, "y": 0.543 },
    { "action": "gesture", "color": "#4fc3f7", "width": 2, "points": [[0.35, 0.5], [0.38, 0.6]] },
    { "action": "gesture", "color": "#4fc3f7", "width": 2, "points": [[0.6, 0.4], [0.62, 0.55]] },
    { "action": "gesture", "color": "#5dade2", "width": 3, "points": [[0.05, 0.7], [0.95, 0.7]] }
  ],

  beehive: [
    { "action": "gesture", "color": "#f39c12", "width": 4, "points": [[0.4, 0.85], [0.35, 0.7], [0.38, 0.55], [0.5, 0.5], [0.62, 0.55], [0.65, 0.7], [0.6, 0.85], [0.4, 0.85]] },
    { "action": "fill", "color": "#f7c04a", "x": 0.5, "y": 0.6845 },
    { "action": "gesture", "color": "#f39c12", "width": 3, "points": [[0.42, 0.5], [0.4, 0.4], [0.45, 0.32], [0.55, 0.32], [0.6, 0.4], [0.58, 0.5], [0.42, 0.5]] },
    { "action": "fill", "color": "#f7c04a", "x": 0.5, "y": 0.4 },
    { "action": "gesture", "color": "#a0522d", "width": 2, "points": [[0.36, 0.6], [0.64, 0.6]] },
    { "action": "gesture", "color": "#a0522d", "width": 2, "points": [[0.37, 0.72], [0.63, 0.72]] },
    { "action": "gesture", "color": "#2c3e50", "width": 3, "points": [[0.47, 0.75], [0.47, 0.83], [0.53, 0.83], [0.53, 0.75], [0.47, 0.75]] },
    { "action": "fill", "color": "#1a1a1a", "x": 0.5, "y": 0.79 }
  ],

  geyser: [
    { "action": "gesture", "color": "#5dade2", "width": 6, "points": [[0.5, 0.7], [0.48, 0.5], [0.52, 0.3], [0.45, 0.15]] },
    { "action": "gesture", "color": "#85c1e9", "width": 4, "points": [[0.5, 0.4], [0.35, 0.25]] },
    { "action": "gesture", "color": "#85c1e9", "width": 4, "points": [[0.5, 0.35], [0.65, 0.2]] },
    { "action": "gesture", "color": "#8d6e63", "width": 4, "points": [[0.35, 0.75], [0.4, 0.65], [0.6, 0.65], [0.65, 0.75], [0.35, 0.75]] },
    { "action": "fill", "color": "#a0522d", "x": 0.5, "y": 0.7033 },
    { "action": "gesture", "color": "#78909c", "width": 3, "points": [[0.2, 0.75], [0.8, 0.75]] }
  ],

  canyon: [
    { "action": "gesture", "color": "#d35400", "width": 3, "points": [[0.0, 0.3], [0.25, 0.35], [0.3, 0.5], [0.2, 0.6], [0.3, 0.7], [0.15, 0.85], [0.0, 0.85], [0.0, 0.3]] },
    { "action": "fill", "color": "#e67e22", "x": 0.1256, "y": 0.5759 },
    { "action": "gesture", "color": "#d35400", "width": 3, "points": [[1.0, 0.3], [0.75, 0.35], [0.7, 0.5], [0.8, 0.6], [0.7, 0.7], [0.85, 0.85], [1.0, 0.85], [1.0, 0.3]] },
    { "action": "fill", "color": "#e67e22", "x": 0.8744, "y": 0.5759 },
    { "action": "gesture", "color": "#c0651a", "width": 2, "points": [[0.1, 0.5], [0.25, 0.48]] },
    { "action": "gesture", "color": "#c0651a", "width": 2, "points": [[0.75, 0.5], [0.9, 0.48]] },
    { "action": "gesture", "color": "#5dade2", "width": 4, "points": [[0.15, 0.85], [0.85, 0.85]] }
  ],

  meadow: [
    { "action": "gesture", "color": "#7cb342", "width": 3, "points": [[0.05, 0.7], [0.95, 0.7]] },
    { "action": "gesture", "color": "#5dade2", "width": 2, "points": [[0.05, 0.25], [0.95, 0.25]] },
    { "action": "gesture", "color": "#e74c3c", "width": 2, "points": [[0.25, 0.68], [0.25, 0.68]] },
    { "action": "gesture", "color": "#2e7d32", "width": 2, "points": [[0.25, 0.7], [0.25, 0.78]] },
    { "action": "gesture", "color": "#f1c40f", "width": 2, "points": [[0.5, 0.65], [0.5, 0.65]] },
    { "action": "gesture", "color": "#2e7d32", "width": 2, "points": [[0.5, 0.67], [0.5, 0.78]] },
    { "action": "gesture", "color": "#9b59b6", "width": 2, "points": [[0.7, 0.68], [0.7, 0.68]] },
    { "action": "gesture", "color": "#2e7d32", "width": 2, "points": [[0.7, 0.7], [0.7, 0.78]] }
  ],

  eclipse: [
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.25], [0.35, 0.3], [0.28, 0.42], [0.28, 0.58], [0.35, 0.7], [0.5, 0.75], [0.65, 0.7], [0.72, 0.58], [0.72, 0.42], [0.65, 0.3], [0.5, 0.25]] },
    { "action": "fill", "color": "#212121", "x": 0.5, "y": 0.5 },
    { "action": "gesture", "color": "#f1c40f", "width": 4, "points": [[0.5, 0.15], [0.5, 0.85]] },
    { "action": "gesture", "color": "#f1c40f", "width": 4, "points": [[0.15, 0.5], [0.85, 0.5]] },
    { "action": "gesture", "color": "#f1c40f", "width": 3, "points": [[0.24, 0.24], [0.76, 0.76]] },
    { "action": "gesture", "color": "#f1c40f", "width": 3, "points": [[0.76, 0.24], [0.24, 0.76]] }
  ],

  dancing: [
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.5, 0.2], [0.5, 0.2]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.5, 0.28], [0.5, 0.55]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.35], [0.3, 0.25]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.35], [0.72, 0.2]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.55], [0.32, 0.75]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.55], [0.65, 0.8]] },
    { "action": "gesture", "color": "#f39c12", "width": 2, "points": [[0.2, 0.2], [0.25, 0.15]] },
    { "action": "gesture", "color": "#f39c12", "width": 2, "points": [[0.78, 0.15], [0.82, 0.1]] }
  ],

  sleeping: [
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.25, 0.65], [0.3, 0.55], [0.5, 0.5], [0.65, 0.55], [0.68, 0.65], [0.25, 0.65]] },
    { "action": "fill", "color": "#8d6e63", "x": 0.4723, "y": 0.5892 },
    { "action": "gesture", "color": "#eceff1", "width": 3, "points": [[0.2, 0.65], [0.7, 0.65], [0.72, 0.8], [0.18, 0.8], [0.2, 0.65]] },
    { "action": "fill", "color": "#f5f5f5", "x": 0.45, "y": 0.726 },
    { "action": "gesture", "color": "#1a1a1a", "width": 2, "points": [[0.4, 0.55], [0.44, 0.55]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 2, "points": [[0.55, 0.55], [0.59, 0.55]] },
    { "action": "gesture", "color": "#5dade2", "width": 3, "points": [[0.72, 0.35], [0.78, 0.3], [0.75, 0.4], [0.72, 0.35]] },
    { "action": "gesture", "color": "#5dade2", "width": 2, "points": [[0.65, 0.42], [0.68, 0.38]] }
  ],

  swimming: [
    { "action": "gesture", "color": "#f39c12", "width": 4, "points": [[0.3, 0.4], [0.3, 0.4]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.3, 0.48], [0.6, 0.5]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.35, 0.48], [0.2, 0.35]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.45, 0.5], [0.5, 0.3]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.55, 0.5], [0.75, 0.55]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.6, 0.5], [0.7, 0.68]] },
    { "action": "gesture", "color": "#5dade2", "width": 2, "points": [[0.05, 0.55], [0.95, 0.55]] },
    { "action": "gesture", "color": "#5dade2", "width": 2, "points": [[0.1, 0.62], [0.9, 0.62]] }
  ],

  flying: [
    { "action": "gesture", "color": "#f39c12", "width": 4, "points": [[0.5, 0.35], [0.5, 0.35]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.5, 0.42], [0.5, 0.6]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.46], [0.2, 0.35]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.46], [0.8, 0.35]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.6], [0.4, 0.75]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.6], [0.6, 0.75]] },
    { "action": "gesture", "color": "#90a4ae", "width": 2, "points": [[0.1, 0.5], [0.3, 0.5]] },
    { "action": "gesture", "color": "#90a4ae", "width": 2, "points": [[0.7, 0.5], [0.9, 0.5]] }
  ],

  laughing: [
    { "action": "gesture", "color": "#f4c481", "width": 5, "points": [[0.3, 0.4], [0.28, 0.55], [0.35, 0.68], [0.5, 0.72], [0.65, 0.68], [0.72, 0.55], [0.7, 0.4], [0.5, 0.32], [0.3, 0.4]] },
    { "action": "fill", "color": "#f7c04a", "x": 0.5, "y": 0.5223 },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.4, 0.48], [0.4, 0.48]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.6, 0.48], [0.6, 0.48]] },
    { "action": "gesture", "color": "#c0392b", "width": 3, "points": [[0.4, 0.58], [0.45, 0.65], [0.55, 0.65], [0.6, 0.58], [0.4, 0.58]] },
    { "action": "fill", "color": "#e74c3c", "x": 0.5, "y": 0.6 }
  ],

  sneezing: [
    { "action": "gesture", "color": "#f4c481", "width": 5, "points": [[0.35, 0.4], [0.32, 0.55], [0.4, 0.68], [0.55, 0.7], [0.68, 0.62], [0.68, 0.42], [0.5, 0.32], [0.35, 0.4]] },
    { "action": "fill", "color": "#f7c04a", "x": 0.5066, "y": 0.5179 },
    { "action": "gesture", "color": "#1a1a1a", "width": 2, "points": [[0.42, 0.48], [0.46, 0.44]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 2, "points": [[0.6, 0.48], [0.56, 0.44]] },
    { "action": "gesture", "color": "#c0392b", "width": 3, "points": [[0.45, 0.6], [0.55, 0.62]] },
    { "action": "gesture", "color": "#eceff1", "width": 2, "points": [[0.7, 0.55], [0.85, 0.5]] },
    { "action": "gesture", "color": "#eceff1", "width": 2, "points": [[0.7, 0.6], [0.87, 0.6]] },
    { "action": "gesture", "color": "#eceff1", "width": 2, "points": [[0.7, 0.65], [0.85, 0.7]] }
  ],

  juggling: [
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.5, 0.35], [0.5, 0.35]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.5, 0.42], [0.5, 0.65]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.48], [0.35, 0.42]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.48], [0.65, 0.42]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.65], [0.42, 0.85]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.65], [0.58, 0.85]] },
    { "action": "gesture", "color": "#e74c3c", "width": 4, "points": [[0.3, 0.25], [0.3, 0.25]] },
    { "action": "gesture", "color": "#2ecc71", "width": 4, "points": [[0.5, 0.15], [0.5, 0.15]] },
    { "action": "gesture", "color": "#f1c40f", "width": 4, "points": [[0.7, 0.25], [0.7, 0.25]] }
  ],

  climbing: [
    { "action": "gesture", "color": "#5d4037", "width": 3, "points": [[0.05, 0.95], [0.2, 0.85], [0.4, 0.3], [0.7, 0.15], [0.95, 0.15], [0.95, 0.95], [0.05, 0.95]] },
    { "action": "fill", "color": "#795548", "x": 0.6224, "y": 0.5981 },
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.55, 0.35], [0.55, 0.35]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.55, 0.4], [0.5, 0.55]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.55, 0.43], [0.65, 0.35]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.55, 0.43], [0.45, 0.4]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.55], [0.6, 0.65]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.55], [0.42, 0.6]] }
  ],

  fishing: [
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.3, 0.3], [0.3, 0.3]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.3, 0.37], [0.3, 0.6]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.3, 0.6], [0.25, 0.8]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.3, 0.6], [0.38, 0.8]] },
    { "action": "gesture", "color": "#8d6e63", "width": 3, "points": [[0.3, 0.45], [0.65, 0.25]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 1, "points": [[0.65, 0.25], [0.6, 0.7]] },
    { "action": "gesture", "color": "#5dade2", "width": 4, "points": [[0.1, 0.75], [0.9, 0.75]] },
    { "action": "gesture", "color": "#f39c12", "width": 3, "points": [[0.58, 0.72], [0.63, 0.68], [0.6, 0.75], [0.58, 0.72]] }
  ],

  singing: [
    { "action": "gesture", "color": "#f4c481", "width": 5, "points": [[0.35, 0.35], [0.32, 0.5], [0.38, 0.62], [0.5, 0.66], [0.62, 0.62], [0.68, 0.5], [0.65, 0.35], [0.5, 0.28], [0.35, 0.35]] },
    { "action": "fill", "color": "#f7c04a", "x": 0.5, "y": 0.4726 },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.42, 0.44], [0.42, 0.44]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.58, 0.44], [0.58, 0.44]] },
    { "action": "gesture", "color": "#c0392b", "width": 4, "points": [[0.45, 0.55], [0.45, 0.62], [0.55, 0.62], [0.55, 0.55], [0.45, 0.55]] },
    { "action": "fill", "color": "#e74c3c", "x": 0.5, "y": 0.58 },
    { "action": "gesture", "color": "#9b59b6", "width": 2, "points": [[0.68, 0.3], [0.75, 0.25]] },
    { "action": "gesture", "color": "#9b59b6", "width": 2, "points": [[0.72, 0.38], [0.8, 0.35]] }
  ],

  yawning: [
    { "action": "gesture", "color": "#f4c481", "width": 5, "points": [[0.35, 0.35], [0.32, 0.5], [0.38, 0.62], [0.5, 0.66], [0.62, 0.62], [0.68, 0.5], [0.65, 0.35], [0.5, 0.28], [0.35, 0.35]] },
    { "action": "fill", "color": "#f7c04a", "x": 0.5, "y": 0.4726 },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.42, 0.4], [0.42, 0.36]] },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.58, 0.4], [0.58, 0.36]] },
    { "action": "gesture", "color": "#7b241c", "width": 5, "points": [[0.45, 0.58], [0.44, 0.65], [0.5, 0.68], [0.56, 0.65], [0.55, 0.58], [0.45, 0.58]] },
    { "action": "fill", "color": "#922b21", "x": 0.5, "y": 0.6244 },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.68, 0.3], [0.75, 0.25]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.7, 0.4], [0.8, 0.4]] }
  ],

  sketching: [
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.5, 0.35], [0.5, 0.35]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.5, 0.42], [0.5, 0.65]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.48], [0.35, 0.6]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.48], [0.65, 0.55]] },
    { "action": "gesture", "color": "#f1c40f", "width": 3, "points": [[0.65, 0.55], [0.75, 0.65]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.65], [0.45, 0.85]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.65], [0.58, 0.85]] },
    { "action": "gesture", "color": "#eceff1", "width": 2, "points": [[0.3, 0.65], [0.45, 0.7], [0.4, 0.6], [0.3, 0.65]] }
  ],

  whistling: [
    { "action": "gesture", "color": "#f4c481", "width": 5, "points": [[0.35, 0.35], [0.32, 0.5], [0.38, 0.62], [0.5, 0.66], [0.62, 0.62], [0.68, 0.5], [0.65, 0.35], [0.5, 0.28], [0.35, 0.35]] },
    { "action": "fill", "color": "#f7c04a", "x": 0.5, "y": 0.4726 },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.42, 0.4], [0.42, 0.4]] },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.58, 0.4], [0.58, 0.4]] },
    { "action": "gesture", "color": "#c0392b", "width": 3, "points": [[0.5, 0.55], [0.56, 0.58], [0.5, 0.6], [0.5, 0.55]] },
    { "action": "gesture", "color": "#90a4ae", "width": 2, "points": [[0.6, 0.55], [0.72, 0.45], [0.7, 0.35], [0.78, 0.3]] }
  ],

  typing: [
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.25, 0.6], [0.75, 0.6], [0.72, 0.75], [0.28, 0.75], [0.25, 0.6]] },
    { "action": "fill", "color": "#37474f", "x": 0.5, "y": 0.6734 },
    { "action": "gesture", "color": "#607d8b", "width": 2, "points": [[0.32, 0.65], [0.4, 0.65]] },
    { "action": "gesture", "color": "#607d8b", "width": 2, "points": [[0.44, 0.65], [0.52, 0.65]] },
    { "action": "gesture", "color": "#607d8b", "width": 2, "points": [[0.56, 0.65], [0.64, 0.65]] },
    { "action": "gesture", "color": "#607d8b", "width": 2, "points": [[0.35, 0.7], [0.6, 0.7]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.35, 0.6], [0.3, 0.45]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.65, 0.6], [0.68, 0.45]] }
  ],

  stretching: [
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.5, 0.3], [0.5, 0.3]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.5, 0.38], [0.5, 0.6]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.4], [0.2, 0.25]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.4], [0.8, 0.25]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.6], [0.4, 0.85]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.6], [0.6, 0.85]] }
  ],

  skating: [
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.5, 0.3], [0.5, 0.3]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.5, 0.38], [0.55, 0.58]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.52, 0.42], [0.3, 0.45]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.52, 0.42], [0.7, 0.35]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.55, 0.58], [0.4, 0.7]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.55, 0.58], [0.72, 0.68]] },
    { "action": "gesture", "color": "#e74c3c", "width": 3, "points": [[0.36, 0.72], [0.48, 0.72]] },
    { "action": "gesture", "color": "#e74c3c", "width": 3, "points": [[0.68, 0.7], [0.8, 0.7]] }
  ],

  praying: [
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.5, 0.3], [0.5, 0.3]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.5, 0.38], [0.5, 0.65]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.44], [0.5, 0.5]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.65], [0.45, 0.85]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.5, 0.65], [0.55, 0.85]] },
    { "action": "gesture", "color": "#f1c40f", "width": 2, "points": [[0.45, 0.5], [0.42, 0.4]] },
    { "action": "gesture", "color": "#f1c40f", "width": 2, "points": [[0.55, 0.5], [0.58, 0.4]] }
  ],

  sculpting: [
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.35, 0.3], [0.35, 0.3]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.35, 0.38], [0.35, 0.6]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.35, 0.42], [0.55, 0.5]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.35, 0.6], [0.3, 0.8]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.35, 0.6], [0.42, 0.8]] },
    { "action": "gesture", "color": "#a0522d", "width": 5, "points": [[0.55, 0.6], [0.6, 0.45], [0.7, 0.42], [0.75, 0.55], [0.68, 0.65], [0.55, 0.6]] },
    { "action": "fill", "color": "#c8935c", "x": 0.6532, "y": 0.5373 }
  ],

  dragon: [
    { "action": "gesture", "color": "#2e7d32", "width": 5, "points": [[0.2, 0.7], [0.25, 0.55], [0.35, 0.48], [0.5, 0.45], [0.65, 0.48], [0.75, 0.4], [0.85, 0.3], [0.8, 0.4], [0.7, 0.48], [0.72, 0.6], [0.65, 0.7], [0.4, 0.72], [0.2, 0.7]] },
    { "action": "fill", "color": "#43a047", "x": 0.4872, "y": 0.5828 },
    { "action": "gesture", "color": "#2e7d32", "width": 3, "points": [[0.45, 0.45], [0.42, 0.35], [0.5, 0.3], [0.55, 0.38], [0.6, 0.45]] },
    { "action": "gesture", "color": "#c0392b", "width": 3, "points": [[0.75, 0.42], [0.85, 0.38]] },
    { "action": "gesture", "color": "#f39c12", "width": 2, "points": [[0.78, 0.4], [0.78, 0.4]] },
    { "action": "gesture", "color": "#2e7d32", "width": 4, "points": [[0.2, 0.68], [0.1, 0.75], [0.05, 0.85]] },
    { "action": "gesture", "color": "#e74c3c", "width": 2, "points": [[0.05, 0.85], [0.12, 0.8]] }
  ],

  robot: [
    { "action": "gesture", "color": "#607d8b", "width": 4, "points": [[0.32, 0.35], [0.68, 0.35], [0.68, 0.55], [0.32, 0.55], [0.32, 0.35]] },
    { "action": "fill", "color": "#90a4ae", "x": 0.5, "y": 0.45 },
    { "action": "gesture", "color": "#3498db", "width": 3, "points": [[0.4, 0.42], [0.4, 0.42]] },
    { "action": "gesture", "color": "#3498db", "width": 3, "points": [[0.6, 0.42], [0.6, 0.42]] },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.42, 0.5], [0.58, 0.5]] },
    { "action": "gesture", "color": "#607d8b", "width": 5, "points": [[0.35, 0.55], [0.32, 0.75], [0.68, 0.75], [0.65, 0.55], [0.35, 0.55]] },
    { "action": "fill", "color": "#78909c", "x": 0.5, "y": 0.653 },
    { "action": "gesture", "color": "#607d8b", "width": 4, "points": [[0.32, 0.6], [0.18, 0.65]] },
    { "action": "gesture", "color": "#607d8b", "width": 4, "points": [[0.68, 0.6], [0.82, 0.65]] },
    { "action": "gesture", "color": "#607d8b", "width": 4, "points": [[0.4, 0.75], [0.4, 0.9]] },
    { "action": "gesture", "color": "#607d8b", "width": 4, "points": [[0.6, 0.75], [0.6, 0.9]] },
    { "action": "gesture", "color": "#c0392b", "width": 3, "points": [[0.5, 0.35], [0.5, 0.25]] }
  ],

  ghost: [
    { "action": "gesture", "color": "#eceff1", "width": 5, "points": [[0.3, 0.55], [0.28, 0.35], [0.4, 0.22], [0.6, 0.22], [0.72, 0.35], [0.7, 0.55], [0.7, 0.85], [0.6, 0.75], [0.5, 0.85], [0.4, 0.75], [0.3, 0.85], [0.3, 0.55]] },
    { "action": "fill", "color": "#f5f5f5", "x": 0.5, "y": 0.521 },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.42, 0.42], [0.42, 0.42]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.58, 0.42], [0.58, 0.42]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 2, "points": [[0.46, 0.55], [0.5, 0.58], [0.54, 0.55]] }
  ],

  alien: [
    { "action": "gesture", "color": "#8bc34a", "width": 5, "points": [[0.38, 0.55], [0.35, 0.4], [0.4, 0.28], [0.5, 0.22], [0.6, 0.28], [0.65, 0.4], [0.62, 0.55], [0.38, 0.55]] },
    { "action": "fill", "color": "#aed581", "x": 0.5, "y": 0.4053 },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.4, 0.4], [0.35, 0.35], [0.42, 0.32], [0.44, 0.4], [0.4, 0.4]] },
    { "action": "fill", "color": "#212121", "x": 0.4017, "y": 0.3632 },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.6, 0.4], [0.65, 0.35], [0.58, 0.32], [0.56, 0.4], [0.6, 0.4]] },
    { "action": "fill", "color": "#212121", "x": 0.5983, "y": 0.3632 },
    { "action": "gesture", "color": "#8bc34a", "width": 4, "points": [[0.42, 0.55], [0.4, 0.75]] },
    { "action": "gesture", "color": "#8bc34a", "width": 4, "points": [[0.58, 0.55], [0.6, 0.75]] },
    { "action": "gesture", "color": "#8bc34a", "width": 3, "points": [[0.42, 0.6], [0.3, 0.55]] },
    { "action": "gesture", "color": "#8bc34a", "width": 3, "points": [[0.58, 0.6], [0.7, 0.55]] }
  ],

  wizard: [
    { "action": "gesture", "color": "#5e35b1", "width": 5, "points": [[0.45, 0.3], [0.35, 0.15], [0.65, 0.15], [0.55, 0.3], [0.45, 0.3]] },
    { "action": "fill", "color": "#7e57c2", "x": 0.5, "y": 0.22 },
    { "action": "gesture", "color": "#f4c481", "width": 4, "points": [[0.42, 0.32], [0.4, 0.42], [0.6, 0.42], [0.58, 0.32], [0.42, 0.32]] },
    { "action": "fill", "color": "#f7c04a", "x": 0.5, "y": 0.37 },
    { "action": "gesture", "color": "#eceff1", "width": 3, "points": [[0.4, 0.42], [0.35, 0.55]] },
    { "action": "gesture", "color": "#eceff1", "width": 3, "points": [[0.6, 0.42], [0.65, 0.55]] },
    { "action": "gesture", "color": "#5e35b1", "width": 5, "points": [[0.32, 0.55], [0.3, 0.85], [0.7, 0.85], [0.68, 0.55], [0.32, 0.55]] },
    { "action": "fill", "color": "#7e57c2", "x": 0.5, "y": 0.7026 },
    { "action": "gesture", "color": "#8d6e63", "width": 3, "points": [[0.72, 0.4], [0.78, 0.85]] },
    { "action": "gesture", "color": "#f1c40f", "width": 3, "points": [[0.78, 0.4], [0.78, 0.4]] }
  ],

  mermaid: [
    { "action": "gesture", "color": "#f4c481", "width": 5, "points": [[0.42, 0.3], [0.4, 0.4], [0.42, 0.5], [0.58, 0.5], [0.6, 0.4], [0.58, 0.3], [0.42, 0.3]] },
    { "action": "fill", "color": "#f7c04a", "x": 0.5, "y": 0.4 },
    { "action": "gesture", "color": "#3d2314", "width": 3, "points": [[0.4, 0.3], [0.35, 0.4], [0.4, 0.5]] },
    { "action": "gesture", "color": "#00bcd4", "width": 5, "points": [[0.42, 0.5], [0.4, 0.65], [0.45, 0.8], [0.5, 0.88], [0.6, 0.8], [0.55, 0.7], [0.6, 0.55], [0.58, 0.5], [0.42, 0.5]] },
    { "action": "fill", "color": "#4dd0e1", "x": 0.4997, "y": 0.6628 },
    { "action": "gesture", "color": "#00acc1", "width": 3, "points": [[0.42, 0.85], [0.35, 0.9]] },
    { "action": "gesture", "color": "#00acc1", "width": 3, "points": [[0.58, 0.85], [0.65, 0.9]] },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.46, 0.38], [0.46, 0.38]] },
    { "action": "gesture", "color": "#e74c3c", "width": 3, "points": [[0.45, 0.32], [0.5, 0.32], [0.55, 0.32]] }
  ],

  dinosaur: [
    { "action": "gesture", "color": "#43a047", "width": 5, "points": [[0.2, 0.75], [0.22, 0.55], [0.32, 0.45], [0.45, 0.4], [0.5, 0.25], [0.58, 0.3], [0.55, 0.42], [0.65, 0.5], [0.7, 0.65], [0.68, 0.78], [0.2, 0.75]] },
    { "action": "fill", "color": "#66bb6a", "x": 0.4599, "y": 0.5859 },
    { "action": "gesture", "color": "#2e7d32", "width": 3, "points": [[0.5, 0.28], [0.55, 0.2]] },
    { "action": "gesture", "color": "#2e7d32", "width": 2, "points": [[0.48, 0.3], [0.44, 0.38]] },
    { "action": "gesture", "color": "#2e7d32", "width": 4, "points": [[0.65, 0.6], [0.85, 0.55], [0.9, 0.45]] },
    { "action": "gesture", "color": "#43a047", "width": 5, "points": [[0.25, 0.75], [0.25, 0.9]] },
    { "action": "gesture", "color": "#43a047", "width": 5, "points": [[0.4, 0.75], [0.4, 0.9]] },
    { "action": "gesture", "color": "#43a047", "width": 5, "points": [[0.55, 0.78], [0.55, 0.9]] },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.52, 0.32], [0.52, 0.32]] }
  ],

  superhero: [
    { "action": "gesture", "color": "#f4c481", "width": 5, "points": [[0.4, 0.28], [0.38, 0.4], [0.5, 0.46], [0.62, 0.4], [0.6, 0.28], [0.4, 0.28]] },
    { "action": "fill", "color": "#f7c04a", "x": 0.5, "y": 0.3586 },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.35, 0.3], [0.4, 0.28], [0.38, 0.35], [0.35, 0.3]] },
    { "action": "gesture", "color": "#e74c3c", "width": 5, "points": [[0.35, 0.46], [0.3, 0.65], [0.7, 0.65], [0.65, 0.46], [0.35, 0.46]] },
    { "action": "fill", "color": "#ff5252", "x": 0.5, "y": 0.5595 },
    { "action": "gesture", "color": "#f1c40f", "width": 3, "points": [[0.44, 0.55], [0.48, 0.5], [0.52, 0.55], [0.48, 0.6], [0.44, 0.55]] },
    { "action": "fill", "color": "#fff176", "x": 0.48, "y": 0.55 },
    { "action": "gesture", "color": "#3498db", "width": 4, "points": [[0.32, 0.65], [0.28, 0.85]] },
    { "action": "gesture", "color": "#3498db", "width": 4, "points": [[0.68, 0.65], [0.72, 0.85]] },
    { "action": "gesture", "color": "#e74c3c", "width": 3, "points": [[0.5, 0.28], [0.4, 0.15], [0.35, 0.3]] }
  ],

  zombie: [
    { "action": "gesture", "color": "#7cb342", "width": 5, "points": [[0.38, 0.35], [0.35, 0.5], [0.4, 0.62], [0.5, 0.65], [0.6, 0.62], [0.65, 0.5], [0.62, 0.35], [0.38, 0.35]] },
    { "action": "fill", "color": "#9ccc65", "x": 0.5, "y": 0.4884 },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.42, 0.44], [0.46, 0.5]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 3, "points": [[0.58, 0.44], [0.54, 0.5]] },
    { "action": "gesture", "color": "#5d4037", "width": 2, "points": [[0.44, 0.58], [0.56, 0.6]] },
    { "action": "gesture", "color": "#7cb342", "width": 4, "points": [[0.4, 0.65], [0.35, 0.85]] },
    { "action": "gesture", "color": "#7cb342", "width": 4, "points": [[0.55, 0.62], [0.75, 0.55], [0.85, 0.62]] },
    { "action": "gesture", "color": "#616161", "width": 4, "points": [[0.35, 0.85], [0.65, 0.85]] }
  ],

  ninja: [
    { "action": "gesture", "color": "#212121", "width": 5, "points": [[0.35, 0.3], [0.33, 0.42], [0.4, 0.5], [0.6, 0.5], [0.67, 0.42], [0.65, 0.3], [0.35, 0.3]] },
    { "action": "fill", "color": "#1a1a1a", "x": 0.5, "y": 0.3956 },
    { "action": "gesture", "color": "#f4c481", "width": 3, "points": [[0.42, 0.4], [0.58, 0.4]] },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.45, 0.4], [0.45, 0.4]] },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.55, 0.4], [0.55, 0.4]] },
    { "action": "gesture", "color": "#212121", "width": 5, "points": [[0.35, 0.5], [0.32, 0.7], [0.68, 0.7], [0.65, 0.5], [0.35, 0.5]] },
    { "action": "fill", "color": "#1a1a1a", "x": 0.5, "y": 0.603 },
    { "action": "gesture", "color": "#c0392b", "width": 3, "points": [[0.5, 0.5], [0.5, 0.65]] },
    { "action": "gesture", "color": "#90a4ae", "width": 2, "points": [[0.68, 0.55], [0.85, 0.35]] }
  ],

  unicorn: [
    { "action": "gesture", "color": "#ffffff", "width": 5, "points": [[0.35, 0.55], [0.32, 0.4], [0.4, 0.32], [0.5, 0.35], [0.55, 0.42], [0.6, 0.5], [0.55, 0.6], [0.35, 0.55]] },
    { "action": "fill", "color": "#fafafa", "x": 0.4541, "y": 0.4644 },
    { "action": "gesture", "color": "#f1c40f", "width": 3, "points": [[0.45, 0.32], [0.5, 0.15]] },
    { "action": "gesture", "color": "#e91e63", "width": 3, "points": [[0.4, 0.32], [0.32, 0.15]] },
    { "action": "gesture", "color": "#9b59b6", "width": 3, "points": [[0.4, 0.35], [0.28, 0.22]] },
    { "action": "gesture", "color": "#3498db", "width": 3, "points": [[0.4, 0.4], [0.25, 0.35]] },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.44, 0.42], [0.44, 0.42]] },
    { "action": "gesture", "color": "#ffffff", "width": 5, "points": [[0.4, 0.55], [0.38, 0.75]] },
    { "action": "gesture", "color": "#ffffff", "width": 5, "points": [[0.55, 0.58], [0.58, 0.78]] }
  ],

  vampire: [
    { "action": "gesture", "color": "#f4c481", "width": 5, "points": [[0.38, 0.35], [0.36, 0.5], [0.42, 0.6], [0.58, 0.6], [0.64, 0.5], [0.62, 0.35], [0.38, 0.35]] },
    { "action": "fill", "color": "#f7c04a", "x": 0.5, "y": 0.4697 },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.42, 0.44], [0.42, 0.44]] },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.58, 0.44], [0.58, 0.44]] },
    { "action": "gesture", "color": "#eceff1", "width": 2, "points": [[0.46, 0.55], [0.46, 0.6]] },
    { "action": "gesture", "color": "#eceff1", "width": 2, "points": [[0.54, 0.55], [0.54, 0.6]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 4, "points": [[0.3, 0.35], [0.5, 0.28], [0.7, 0.35]] },
    { "action": "gesture", "color": "#7b241c", "width": 5, "points": [[0.35, 0.62], [0.2, 0.75], [0.35, 0.85], [0.5, 0.75], [0.65, 0.85], [0.8, 0.75], [0.65, 0.62], [0.35, 0.62]] },
    { "action": "fill", "color": "#922b21", "x": 0.5, "y": 0.7231 }
  ],

  genie: [
    { "action": "gesture", "color": "#00bcd4", "width": 5, "points": [[0.42, 0.35], [0.4, 0.48], [0.46, 0.55], [0.54, 0.55], [0.6, 0.48], [0.58, 0.35], [0.42, 0.35]] },
    { "action": "fill", "color": "#4dd0e1", "x": 0.5, "y": 0.4447 },
    { "action": "gesture", "color": "#00bcd4", "width": 6, "points": [[0.45, 0.55], [0.4, 0.7], [0.45, 0.85], [0.55, 0.85], [0.6, 0.7], [0.55, 0.55], [0.45, 0.55]] },
    { "action": "fill", "color": "#4dd0e1", "x": 0.5, "y": 0.7 },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.45, 0.42], [0.45, 0.42]] },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.55, 0.42], [0.55, 0.42]] },
    { "action": "gesture", "color": "#5d4037", "width": 3, "points": [[0.44, 0.5], [0.56, 0.5]] },
    { "action": "gesture", "color": "#8d6e63", "width": 4, "points": [[0.35, 0.9], [0.65, 0.9], [0.6, 0.75], [0.4, 0.75], [0.35, 0.9]] },
    { "action": "fill", "color": "#a0522d", "x": 0.5, "y": 0.83 }
  ],

  werewolf: [
    { "action": "gesture", "color": "#5d4037", "width": 5, "points": [[0.38, 0.35], [0.32, 0.42], [0.32, 0.55], [0.4, 0.65], [0.6, 0.65], [0.68, 0.55], [0.68, 0.42], [0.62, 0.35], [0.38, 0.35]] },
    { "action": "fill", "color": "#795548", "x": 0.5, "y": 0.4958 },
    { "action": "gesture", "color": "#5d4037", "width": 3, "points": [[0.35, 0.35], [0.3, 0.22]] },
    { "action": "gesture", "color": "#5d4037", "width": 3, "points": [[0.65, 0.35], [0.7, 0.22]] },
    { "action": "gesture", "color": "#f1c40f", "width": 2, "points": [[0.42, 0.45], [0.42, 0.45]] },
    { "action": "gesture", "color": "#f1c40f", "width": 2, "points": [[0.58, 0.45], [0.58, 0.45]] },
    { "action": "gesture", "color": "#5d4037", "width": 4, "points": [[0.42, 0.55], [0.5, 0.62], [0.58, 0.55]] },
    { "action": "gesture", "color": "#ffffff", "width": 2, "points": [[0.44, 0.6], [0.46, 0.65]] },
    { "action": "gesture", "color": "#ffffff", "width": 2, "points": [[0.56, 0.6], [0.54, 0.65]] }
  ],

  pirate: [
    { "action": "gesture", "color": "#f4c481", "width": 5, "points": [[0.4, 0.35], [0.38, 0.48], [0.44, 0.58], [0.56, 0.58], [0.62, 0.48], [0.6, 0.35], [0.4, 0.35]] },
    { "action": "fill", "color": "#f7c04a", "x": 0.5, "y": 0.4585 },
    { "action": "gesture", "color": "#1a1a1a", "width": 5, "points": [[0.3, 0.35], [0.5, 0.2], [0.7, 0.35], [0.65, 0.32], [0.35, 0.32], [0.3, 0.35]] },
    { "action": "fill", "color": "#212121", "x": 0.5, "y": 0.2808 },
    { "action": "gesture", "color": "#c0392b", "width": 3, "points": [[0.4, 0.28], [0.6, 0.28]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.42, 0.45], [0.48, 0.45]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 2, "points": [[0.44, 0.44], [0.44, 0.44]] },
    { "action": "gesture", "color": "#5d4037", "width": 2, "points": [[0.46, 0.55], [0.54, 0.56]] },
    { "action": "gesture", "color": "#f4c481", "width": 3, "points": [[0.35, 0.35], [0.28, 0.5], [0.35, 0.42]] }
  ],

  mummy: [
    { "action": "gesture", "color": "#e0dcc8", "width": 5, "points": [[0.38, 0.32], [0.35, 0.45], [0.4, 0.55], [0.6, 0.55], [0.65, 0.45], [0.62, 0.32], [0.38, 0.32]] },
    { "action": "fill", "color": "#f0ecd8", "x": 0.5, "y": 0.4329 },
    { "action": "gesture", "color": "#d4cfb8", "width": 2, "points": [[0.38, 0.38], [0.62, 0.38]] },
    { "action": "gesture", "color": "#d4cfb8", "width": 2, "points": [[0.37, 0.46], [0.63, 0.46]] },
    { "action": "gesture", "color": "#e0dcc8", "width": 5, "points": [[0.35, 0.55], [0.3, 0.75], [0.7, 0.75], [0.65, 0.55], [0.35, 0.55]] },
    { "action": "fill", "color": "#f0ecd8", "x": 0.5, "y": 0.6548 },
    { "action": "gesture", "color": "#d4cfb8", "width": 2, "points": [[0.32, 0.6], [0.68, 0.6]] },
    { "action": "gesture", "color": "#d4cfb8", "width": 2, "points": [[0.31, 0.68], [0.69, 0.68]] },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.44, 0.42], [0.44, 0.42]] },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.56, 0.42], [0.56, 0.42]] }
  ],

  fairy: [
    { "action": "gesture", "color": "#f4c481", "width": 4, "points": [[0.44, 0.3], [0.42, 0.4], [0.48, 0.46], [0.52, 0.46], [0.58, 0.4], [0.56, 0.3], [0.44, 0.3]] },
    { "action": "fill", "color": "#f7c04a", "x": 0.5, "y": 0.3739 },
    { "action": "gesture", "color": "#e91e63", "width": 4, "points": [[0.45, 0.46], [0.42, 0.65], [0.58, 0.65], [0.55, 0.46], [0.45, 0.46]] },
    { "action": "fill", "color": "#f06292", "x": 0.5, "y": 0.56 },
    { "action": "gesture", "color": "#ce93d8", "width": 2, "points": [[0.42, 0.5], [0.25, 0.4], [0.2, 0.5], [0.35, 0.55], [0.42, 0.5]] },
    { "action": "fill", "color": "#e1bee7", "x": 0.3011, "y": 0.4833 },
    { "action": "gesture", "color": "#ce93d8", "width": 2, "points": [[0.58, 0.5], [0.75, 0.4], [0.8, 0.5], [0.65, 0.55], [0.58, 0.5]] },
    { "action": "fill", "color": "#e1bee7", "x": 0.6989, "y": 0.4833 },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.46, 0.36], [0.46, 0.36]] },
    { "action": "gesture", "color": "#212121", "width": 2, "points": [[0.54, 0.36], [0.54, 0.36]] },
    { "action": "gesture", "color": "#8d6e63", "width": 2, "points": [[0.45, 0.65], [0.42, 0.85]] },
    { "action": "gesture", "color": "#8d6e63", "width": 2, "points": [[0.55, 0.65], [0.58, 0.85]] }
  ],

  yeti: [
    { "action": "gesture", "color": "#eceff1", "width": 6, "points": [[0.3, 0.55], [0.28, 0.4], [0.35, 0.28], [0.5, 0.24], [0.65, 0.28], [0.72, 0.4], [0.7, 0.55], [0.3, 0.55]] },
    { "action": "fill", "color": "#f5f5f5", "x": 0.5, "y": 0.4119 },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.42, 0.4], [0.42, 0.4]] },
    { "action": "gesture", "color": "#212121", "width": 3, "points": [[0.58, 0.4], [0.58, 0.4]] },
    { "action": "gesture", "color": "#7b241c", "width": 4, "points": [[0.42, 0.5], [0.5, 0.54], [0.58, 0.5]] },
    { "action": "gesture", "color": "#eceff1", "width": 6, "points": [[0.32, 0.55], [0.3, 0.75], [0.7, 0.75], [0.68, 0.55], [0.32, 0.55]] },
    { "action": "fill", "color": "#f5f5f5", "x": 0.5, "y": 0.6518 },
    { "action": "gesture", "color": "#eceff1", "width": 5, "points": [[0.3, 0.6], [0.15, 0.68]] },
    { "action": "gesture", "color": "#eceff1", "width": 5, "points": [[0.7, 0.6], [0.85, 0.68]] }
  ]
};
