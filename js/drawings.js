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

const DRAWINGS = {
  guitar: [
    { "action": "gesture", "color": "#8b4513", "width": 5, "points": [[0.46, 0.52], [0.42, 0.55], [0.4, 0.62], [0.44, 0.68], [0.38, 0.74], [0.38, 0.82], [0.44, 0.88], [0.56, 0.88], [0.62, 0.82], [0.62, 0.74], [0.56, 0.68], [0.6, 0.62], [0.58, 0.55], [0.54, 0.52], [0.46, 0.52]] },
    { "action": "fill", "color": "#cd853f", "x": 0.5, "y": 0.78 },
    { "action": "gesture", "color": "#3e2723", "width": 4, "points": [[0.46, 0.72], [0.54, 0.72], [0.54, 0.8], [0.46, 0.8], [0.46, 0.72]] },
    { "action": "fill", "color": "#212121", "x": 0.5, "y": 0.76 },
    { "action": "gesture", "color": "#4e342e", "width": 8, "points": [[0.5, 0.52], [0.5, 0.22]] },
    { "action": "gesture", "color": "#3e2723", "width": 5, "points": [[0.47, 0.22], [0.53, 0.22], [0.54, 0.14], [0.46, 0.14], [0.47, 0.22]] },
    { "action": "fill", "color": "#3e2723", "x": 0.5, "y": 0.18 },
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
    { "action": "fill", "color": "#e74c3c", "x": 0.35, "y": 0.45 },
    { "action": "gesture", "color": "#3498db", "width": 3, "points": [[0.5, 0.2], [0.35, 0.55], [0.5, 0.55], [0.5, 0.2]] },
    { "action": "fill", "color": "#3498db", "x": 0.44, "y": 0.45 },
    { "action": "gesture", "color": "#2ecc71", "width": 3, "points": [[0.5, 0.2], [0.5, 0.55], [0.65, 0.55], [0.5, 0.2]] },
    { "action": "fill", "color": "#2ecc71", "x": 0.56, "y": 0.45 },
    { "action": "gesture", "color": "#f1c40f", "width": 3, "points": [[0.5, 0.2], [0.65, 0.55], [0.8, 0.55], [0.5, 0.2]] },
    { "action": "fill", "color": "#f1c40f", "x": 0.65, "y": 0.45 }
  ],

  bicycle: [
    { "action": "gesture", "color": "#1a1a1a", "width": 5, "points": [[0.28, 0.68], [0.22, 0.65], [0.18, 0.56], [0.22, 0.47], [0.28, 0.44], [0.34, 0.47], [0.38, 0.56], [0.34, 0.65], [0.28, 0.68]] },
    { "action": "gesture", "color": "#1a1a1a", "width": 5, "points": [[0.72, 0.68], [0.66, 0.65], [0.62, 0.56], [0.66, 0.47], [0.72, 0.44], [0.78, 0.47], [0.82, 0.56], [0.78, 0.65], [0.72, 0.68]] },
    { "action": "gesture", "color": "#e74c3c", "width": 6, "points": [[0.28, 0.56], [0.46, 0.56], [0.64, 0.42], [0.44, 0.42], [0.28, 0.56]] },
    { "action": "gesture", "color": "#e74c3c", "width": 6, "points": [[0.46, 0.56], [0.72, 0.56], [0.64, 0.42]] },
    { "action": "gesture", "color": "#333333", "width": 5, "points": [[0.44, 0.42], [0.44, 0.35]] },
    { "action": "gesture", "color": "#795548", "width": 7, "points": [[0.38, 0.35], [0.48, 0.35]] },
    { "action": "gesture", "color": "#333333", "width": 5, "points": [[0.72, 0.56], [0.66, 0.32]] },
    { "action": "gesture", "color": "#333333", "width": 5, "points": [[0.66, 0.32], [0.58, 0.32], [0.66, 0.28]] }
  ],

  chair: [
    { "action": "gesture", "color": "#5c4033", "width": 6, "points": [[0.35, 0.2], [0.65, 0.2], [0.65, 0.55], [0.35, 0.55], [0.35, 0.2]] },
    { "action": "gesture", "color": "#5c4033", "width": 4, "points": [[0.43, 0.2], [0.43, 0.55]] },
    { "action": "gesture", "color": "#5c4033", "width": 4, "points": [[0.5, 0.2], [0.5, 0.55]] },
    { "action": "gesture", "color": "#5c4033", "width": 4, "points": [[0.57, 0.2], [0.57, 0.55]] },
    { "action": "gesture", "color": "#e74c3c", "width": 6, "points": [[0.32, 0.55], [0.68, 0.55], [0.64, 0.62], [0.36, 0.62], [0.32, 0.55]] },
    { "action": "fill", "color": "#c0392b", "x": 0.5, "y": 0.58 },
    { "action": "gesture", "color": "#5c4033", "width": 7, "points": [[0.36, 0.62], [0.36, 0.9]] },
    { "action": "gesture", "color": "#5c4033", "width": 7, "points": [[0.64, 0.62], [0.64, 0.9]] },
    { "action": "gesture", "color": "#4a3226", "width": 4, "points": [[0.38, 0.62], [0.42, 0.85]] },
    { "action": "gesture", "color": "#4a3226", "width": 4, "points": [[0.62, 0.62], [0.58, 0.85]] }
  ],

  candle: [
    { "action": "gesture", "color": "#7f8c8d", "width": 5, "points": [[0.32, 0.86], [0.68, 0.86], [0.62, 0.92], [0.38, 0.92], [0.32, 0.86]] },
    { "action": "fill", "color": "#95a5a6", "x": 0.5, "y": 0.89 },
    { "action": "gesture", "color": "#9b59b6", "width": 4, "points": [[0.42, 0.86], [0.58, 0.86], [0.58, 0.44], [0.42, 0.44], [0.42, 0.86]] },
    { "action": "fill", "color": "#8e44ad", "x": 0.5, "y": 0.6 },
    { "action": "gesture", "color": "#000000", "width": 3, "points": [[0.5, 0.44], [0.5, 0.35]] },
    { "action": "gesture", "color": "#e67e22", "width": 2, "points": [[0.5, 0.35], [0.44, 0.25], [0.5, 0.12], [0.56, 0.25], [0.5, 0.35]] },
    { "action": "fill", "color": "#e39709", "x": 0.5, "y": 0.24 }
  ],

  clock: [
    { "action": "gesture", "color": "#2c3e50", "width": 6, "points": [[0.5, 0.22], [0.58, 0.23], [0.65, 0.26], [0.71, 0.31], [0.76, 0.37], [0.79, 0.44], [0.8, 0.52], [0.79, 0.6], [0.76, 0.67], [0.71, 0.73], [0.65, 0.78], [0.58, 0.81], [0.5, 0.82], [0.42, 0.81], [0.35, 0.78], [0.29, 0.73], [0.24, 0.67], [0.21, 0.6], [0.2, 0.52], [0.21, 0.44], [0.24, 0.37], [0.29, 0.31], [0.35, 0.26], [0.42, 0.23], [0.5, 0.22]] },
    { "action": "fill", "color": "#ffffff", "x": 0.5, "y": 0.52 },
    { "action": "gesture", "color": "#e74c3c", "width": 6, "points": [[0.35, 0.26], [0.23, 0.16], [0.34, 0.11], [0.42, 0.18], [0.35, 0.26]] },
    { "action": "fill", "color": "#c0392b", "x": 0.32, "y": 0.17 },
    { "action": "gesture", "color": "#e74c3c", "width": 6, "points": [[0.65, 0.26], [0.77, 0.16], [0.66, 0.11], [0.58, 0.18], [0.65, 0.26]] },
    { "action": "fill", "color": "#c0392b", "x": 0.68, "y": 0.17 },
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
    { "action": "fill", "color": "#ffffff", "x": 0.38, "y": 0.5 },
    { "action": "gesture", "color": "#ffc107", "width": 10, "points": [[0.52, 0.5], [0.86, 0.5]] },
    { "action": "gesture", "color": "#ffc107", "width": 6, "points": [[0.7, 0.5], [0.7, 0.62], [0.74, 0.62], [0.74, 0.5]] },
    { "action": "fill", "color": "#ffa000", "x": 0.72, "y": 0.56 },
    { "action": "gesture", "color": "#ffc107", "width": 6, "points": [[0.8, 0.5], [0.8, 0.62], [0.84, 0.62], [0.84, 0.5]] },
    { "action": "fill", "color": "#ffa000", "x": 0.82, "y": 0.56 }
  ],

  hammer: [
    { "action": "gesture", "color": "#8B4513", "width": 12, "points": [[0.5, 0.4], [0.5, 0.9]] },
    { "action": "gesture", "color": "#8B4513", "width": 14, "points": [[0.5, 0.9], [0.5, 0.95]] },
    { "action": "gesture", "color": "#455a64", "width": 20, "points": [[0.35, 0.25], [0.65, 0.25], [0.65, 0.4], [0.35, 0.4], [0.35, 0.25]] },
    { "action": "gesture", "color": "#455a64", "width": 18, "points": [[0.25, 0.28], [0.35, 0.25], [0.35, 0.4], [0.25, 0.37], [0.25, 0.28]] },
    { "action": "fill", "color": "#8B4513", "x": 0.5, "y": 0.7 },
    { "action": "fill", "color": "#455a64", "x": 0.5, "y": 0.32 },
    { "action": "fill", "color": "#455a64", "x": 0.3, "y": 0.32 }
  ],

  camera: [
    { "action": "gesture", "color": "#263238", "width": 4, "points": [[0.24, 0.76], [0.76, 0.76], [0.76, 0.38], [0.24, 0.38], [0.24, 0.76]] },
    { "action": "fill", "color": "#37474f", "x": 0.3, "y": 0.6 },
    { "action": "gesture", "color": "#263238", "width": 4, "points": [[0.42, 0.38], [0.42, 0.32], [0.58, 0.32], [0.58, 0.38]] },
    { "action": "fill", "color": "#455a64", "x": 0.5, "y": 0.35 },
    { "action": "gesture", "color": "#eceff1", "width": 5, "points": [[0.5, 0.44], [0.62, 0.56], [0.5, 0.68], [0.38, 0.56], [0.5, 0.44]] },
    { "action": "fill", "color": "#00e5ff", "x": 0.5, "y": 0.56 },
    { "action": "gesture", "color": "#ff1744", "width": 8, "points": [[0.32, 0.46], [0.32, 0.46]] }
  ],

  scissors: [
    { "action": "gesture", "color": "#e91e63", "width": 6, "points": [[0.4, 0.7], [0.3, 0.8], [0.35, 0.85], [0.45, 0.75], [0.4, 0.7]] },
    { "action": "fill", "color": "#ff4081", "x": 0.37, "y": 0.77 },
    { "action": "gesture", "color": "#e91e63", "width": 6, "points": [[0.6, 0.7], [0.7, 0.8], [0.65, 0.85], [0.55, 0.75], [0.6, 0.7]] },
    { "action": "fill", "color": "#ff4081", "x": 0.63, "y": 0.77 },
    { "action": "gesture", "color": "#b0bec5", "width": 5, "points": [[0.42, 0.68], [0.5, 0.5], [0.25, 0.25], [0.3, 0.22], [0.52, 0.48], [0.42, 0.68]] },
    { "action": "gesture", "color": "#b0bec5", "width": 5, "points": [[0.58, 0.68], [0.5, 0.5], [0.75, 0.25], [0.7, 0.22], [0.48, 0.48], [0.58, 0.68]] },
    { "action": "fill", "color": "#cfd8dc", "x": 0.35, "y": 0.35 },
    { "action": "fill", "color": "#cfd8dc", "x": 0.65, "y": 0.35 },
    { "action": "gesture", "color": "#212121", "width": 4, "points": [[0.5, 0.5], [0.5, 0.5]] },
    { "action": "fill", "color": "#212121", "x": 0.5, "y": 0.5 }
  ],
};
