// ── Skin system ──────────────────────────────────────────────────────────────
// Central registry of color palettes for canvas games. Every game declares its
// own typed palette interface (background, hud, and its entity colors) plus a
// `Record<SkinId, <Game>Palette>`. This is the ONLY place game colors live, so
// the SkinSelector can swap them at runtime without touching game logic.

export type SkinId = 'classic' | 'neon' | 'retro';

export const SKIN_IDS: SkinId[] = ['classic', 'neon', 'retro'];

export const DEFAULT_SKIN: SkinId = 'classic';

export const SKIN_LABELS: Record<SkinId, string> = {
  classic: 'CLÁSICO',
  neon: 'NEON',
  retro: 'RETRO',
};

// ── Asteroides ───────────────────────────────────────────────────────────────

export interface AsteroidsPalette {
  /** Canvas background fill. */
  bg: string;
  /** Ship outline. */
  ship: string;
  /** Engine thrust flame. */
  thrust: string;
  /** Asteroid outline. */
  asteroid: string;
  /** Bullet fill. */
  bullet: string;
  /** Power-up box + glyph. */
  powerUp: string;
  /** Explosion particle stroke as `rgb()` (alpha appended at draw time). */
  particle: string;
  /** HUD text + life icons. */
  hud: string;
  /** Triple-shot HUD accent. */
  hudAccent: string;
  /** Glow radius (shadowBlur). 0 disables glow (classic). */
  glow: number;
}

export const ASTEROIDS_SKINS: Record<SkinId, AsteroidsPalette> = {
  // Exact replica of the original hardcoded colors. Default; never changes.
  classic: {
    bg: '#000',
    ship: '#fff',
    thrust: 'rgba(255, 130, 0, 0.85)',
    asteroid: '#fff',
    bullet: '#fff',
    powerUp: '#0ff',
    particle: '255,255,255',
    hud: '#fff',
    hudAccent: '#0ff',
    glow: 0,
  },
  // Saturated, vibrant, aligned to the site CSS tokens, with glow.
  neon: {
    bg: '#0a0a0f', // --bg
    ship: '#00f5ff', // --cyan
    thrust: 'rgba(255, 0, 110, 0.9)', // --magenta
    asteroid: '#00f5ff', // --cyan
    bullet: '#f5ff00', // --yellow
    powerUp: '#ff006e', // --magenta
    particle: '0,245,255', // cyan sparks
    hud: '#e6e9ff', // --ink
    hudAccent: '#00ff88', // --green
    glow: 12,
  },
  // CRT / phosphor: warm amber hull, green phosphor accents, soft glow.
  retro: {
    bg: '#0b0900',
    ship: '#ffb000', // amber phosphor
    thrust: 'rgba(255, 90, 30, 0.9)',
    asteroid: '#ffcf3a', // warm gold
    bullet: '#9bff6a', // pale phosphor green
    powerUp: '#39ff14', // bright phosphor green
    particle: '255,176,0', // amber sparks
    hud: '#ffd27a', // warm amber HUD
    hudAccent: '#39ff14',
    glow: 6,
  },
};

// ── Snake ──────────────────────────────────────────────────────────────────────

export interface SnakePalette {
  /** Canvas background fill. */
  bg: string;
  /** Subtle grid lines (full rgba/rgb string, drawn as-is). */
  grid: string;
  /** Snake head cell fill. */
  snakeHead: string;
  /** Snake body cell fill. */
  snakeBody: string;
  /** Pause / game-over overlay backdrop (full rgba string). */
  overlayBg: string;
  /** Pause / game-over overlay text. */
  overlayText: string;
  /** Glow radius (shadowBlur) on snake cells. 0 disables glow (classic). */
  glow: number;
}

export const SNAKE_SKINS: Record<SkinId, SnakePalette> = {
  // Exact replica of the original hardcoded colors. Default; never changes.
  classic: {
    bg: '#0a0a12',
    grid: 'rgba(46, 194, 126, 0.06)',
    snakeHead: '#aef6c8',
    snakeBody: '#2ec27e',
    overlayBg: 'rgba(0, 0, 0, 0.6)',
    overlayText: '#fff',
    glow: 0,
  },
  // Saturated, vibrant, aligned to the site CSS tokens, with glow.
  neon: {
    bg: '#0a0a0f', // --bg
    grid: 'rgba(0, 245, 255, 0.07)', // --cyan, faint
    snakeHead: '#f5ff00', // --yellow (bright head leads the trail)
    snakeBody: '#00ff88', // --green
    overlayBg: 'rgba(10, 10, 15, 0.7)',
    overlayText: '#00f5ff', // --cyan
    glow: 10,
  },
  // CRT / phosphor: warm amber backdrop, green phosphor snake, soft glow.
  retro: {
    bg: '#0b0900',
    grid: 'rgba(57, 255, 20, 0.08)', // phosphor green grid
    snakeHead: '#ffd27a', // warm amber head
    snakeBody: '#39ff14', // bright phosphor green body
    overlayBg: 'rgba(11, 9, 0, 0.72)',
    overlayText: '#ffb000', // amber phosphor
    glow: 6,
  },
};

// ── Tetris ────────────────────────────────────────────────────────────────

export interface TetrisPalette {
  /** Canvas background fill. */
  bg: string;
  /** Subtle grid lines (full rgba string). */
  grid: string;
  /**
   * Colors for each piece type, indexed by type id (1–8). Index 0 is null
   * (empty cell). This is a tuple with a leading null to keep type ids aligned.
   */
  pieces: [
    null,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  /** Top-edge highlight painted over each block to give a bevel effect. */
  highlight: string;
  /** Ghost piece alpha (0–1). */
  ghostAlpha: number;
  /** Glow radius (shadowBlur) on blocks. 0 disables glow (classic). */
  glow: number;
  /** Glow color (shadowColor). Empty string when glow is 0. */
  glowColor: string;
}

export const TETRIS_SKINS: Record<SkinId, TetrisPalette> = {
  // Exact replica of the original hardcoded colors. Default; never changes.
  classic: {
    bg: '#000',
    grid: 'rgba(255,255,255,0.06)',
    pieces: [
      null,
      '#4dd0e1', // I - cyan
      '#ffd54f', // O - yellow
      '#ba68c8', // T - purple
      '#81c784', // S - green
      '#e57373', // Z - red
      '#90caf9', // J - pale blue
      '#ffb74d', // L - orange
      '#9e9e9e', // N - tuerca (gris metálico)
    ],
    highlight: 'rgba(255,255,255,0.12)',
    ghostAlpha: 0.2,
    glow: 0,
    glowColor: '',
  },
  // Saturated, vibrant, aligned to the site CSS tokens, with glow.
  neon: {
    bg: '#0a0a0f', // --bg
    grid: 'rgba(0,245,255,0.05)', // --cyan, faint
    pieces: [
      null,
      '#00f5ff', // I - --cyan
      '#f5ff00', // O - --yellow
      '#ff006e', // T - --magenta
      '#00ff88', // S - --green
      '#ff4d6d', // Z - hot pink-red
      '#7b61ff', // J - electric violet
      '#ff9500', // L - vivid orange
      '#8a8fb5', // N - --ink-dim (silver)
    ],
    highlight: 'rgba(255,255,255,0.18)',
    ghostAlpha: 0.18,
    glow: 10,
    glowColor: '#00f5ff', // --cyan
  },
  // CRT / phosphor: amber and phosphor-green palette, warm dark backdrop.
  retro: {
    bg: '#0b0900',
    grid: 'rgba(255,176,0,0.07)', // amber phosphor grid
    pieces: [
      null,
      '#39ff14', // I - phosphor green
      '#ffb000', // O - amber
      '#ff6b35', // T - phosphor orange
      '#9bff6a', // S - pale phosphor green
      '#ff3d3d', // Z - phosphor red
      '#ffd27a', // J - warm amber
      '#ffcf3a', // L - gold
      '#8fa88f', // N - desaturated phosphor
    ],
    highlight: 'rgba(255,220,120,0.14)',
    ghostAlpha: 0.2,
    glow: 6,
    glowColor: '#ffb000', // amber phosphor
  },
};

// ── Arkanoid ───────────────────────────────────────────────────────────────
// Arkanoid renders its paddle/ball/blocks from a spritesheet PNG, so the only
// programmable colors are the playfield background, the glow cast around the
// sprites and an optional tint laid over them, plus the overlay/HUD text. The
// `tint` recolors the opaque sprite pixels via a `source-atop` pass (null keeps
// the original spritesheet colors, exactly as in classic).

export interface ArkanoidPalette {
  /** Playfield background fill. */
  bg: string;
  /** Glow cast around sprites (shadowColor). */
  glowColor: string;
  /** Glow radius (shadowBlur). 0 disables glow (classic). */
  glow: number;
  /** Translucent tint laid over sprite pixels, or null to keep original art. */
  tint: string | null;
  /** Game-over / win / pause overlay backdrop fill. */
  overlay: string;
  /** Overlay + pause text color. */
  text: string;
}

export const ARKANOID_SKINS: Record<SkinId, ArkanoidPalette> = {
  // Exact replica of the original hardcoded colors. Default; never changes.
  classic: {
    bg: '#000',
    glowColor: 'transparent',
    glow: 0,
    tint: null,
    overlay: 'rgba(0, 0, 0, 0.6)',
    text: '#fff',
  },
  // Saturated, vibrant, aligned to the site CSS tokens, with a cyan glow.
  neon: {
    bg: '#0a0a0f', // --bg
    glowColor: '#00f5ff', // --cyan
    glow: 14,
    tint: null, // keep the vivid spritesheet colors; the glow makes them "vibrate"
    overlay: 'rgba(10, 10, 15, 0.72)',
    text: '#00f5ff', // --cyan
  },
  // CRT / phosphor: warm amber playfield, soft amber glow + amber tint.
  retro: {
    bg: '#0b0900',
    glowColor: '#ffb000', // amber phosphor
    glow: 8,
    tint: 'rgba(255, 176, 0, 0.28)',
    overlay: 'rgba(11, 9, 0, 0.72)',
    text: '#ffd27a', // warm amber
  },
};

// ── Frogger ──────────────────────────────────────────────────────────────────
// Frogger draws everything procedurally (no spritesheet): zone backgrounds,
// vehicles, river objects, the frog and an internal HUD. The palette covers each
// of those families plus an optional glow (shadowBlur/shadowColor) used by neon
// and retro to make the entities "vibrate" on the dark CRT shell.

export interface FroggerPalette {
  /** Top goals strip background. */
  goalsRow: string;
  /** River band background. */
  river: string;
  /** Safe rows (mid island + start). */
  safe: string;
  /** Road band background. */
  road: string;
  /** Dashed lane divider lines (full rgba string). */
  laneLine: string;
  /** Goal mouth (lily-pad slot) background. */
  goalMouth: string;
  /** Goal mouth border. */
  goalBorder: string;
  /** Frog placed inside a completed goal. */
  goalFrog: string;
  /** The four cycling car body colors. */
  cars: [string, string, string, string];
  /** Car windshield (full rgba string). */
  windshield: string;
  /** Vehicle wheels. */
  wheel: string;
  /** Truck trailer body. */
  truckTrailer: string;
  /** Truck cab. */
  truckCab: string;
  /** Log body. */
  log: string;
  /** Log grain lines (stroke, full rgba string). */
  logGrain: string;
  /** Log end-ring. */
  logRing: string;
  /** Turtle skin/body. */
  turtleBody: string;
  /** Turtle shell. */
  turtleShell: string;
  /** Submerged turtle ripple stroke (full rgba string). */
  turtleSubmerged: string;
  /** Frog body. */
  frogBody: string;
  /** Frog legs. */
  frogLegs: string;
  /** Frog eye whites. */
  frogEye: string;
  /** Frog pupils. */
  frogPupil: string;
  /** HUD score text. */
  hudScore: string;
  /** HUD level text + life icon body. */
  hudLevel: string;
  /** HUD life icon body. */
  hudLife: string;
  /** HUD life icon eyes. */
  hudLifeEye: string;
  /** Time bar fill > 50%. */
  timeBarHigh: string;
  /** Time bar fill 25–50%. */
  timeBarMid: string;
  /** Time bar fill < 25%. */
  timeBarLow: string;
  /** Time bar track background (full rgba string). */
  timeBarBg: string;
  /** Glow radius (shadowBlur) on entities. 0 disables glow (classic). */
  glow: number;
}

export const FROGGER_SKINS: Record<SkinId, FroggerPalette> = {
  // Exact replica of the original hardcoded colors. Default; never changes.
  classic: {
    goalsRow: '#0a3a1a',
    river: '#0a3a5c',
    safe: '#13361f',
    road: '#1a1a1f',
    laneLine: 'rgba(255,255,255,0.18)',
    goalMouth: '#06280f',
    goalBorder: '#d4af37',
    goalFrog: '#3bbf3b',
    cars: ['#e23b3b', '#f5c518', '#3b7de2', '#d23bd2'],
    windshield: 'rgba(180,230,255,0.8)',
    wheel: '#111',
    truckTrailer: '#9aa0a6',
    truckCab: '#d23b3b',
    log: '#7a4a23',
    logGrain: 'rgba(60,32,12,0.7)',
    logRing: '#5c3417',
    turtleBody: '#2faa57',
    turtleShell: '#1d7a3c',
    turtleSubmerged: 'rgba(120,220,160,0.45)',
    frogBody: '#7CFC00',
    frogLegs: '#5bbf00',
    frogEye: '#fff',
    frogPupil: '#111',
    hudScore: '#fff',
    hudLevel: '#7CFC00',
    hudLife: '#7CFC00',
    hudLifeEye: '#fff',
    timeBarHigh: '#3bd46a',
    timeBarMid: '#f5c518',
    timeBarLow: '#e23b3b',
    timeBarBg: 'rgba(0,0,0,0.5)',
    glow: 0,
  },
  // Saturated, vibrant, aligned to the site CSS tokens, with glow.
  neon: {
    goalsRow: '#0a1a14',
    river: '#04122a', // deep electric blue
    safe: '#0a1410',
    road: '#0a0a0f', // --bg
    laneLine: 'rgba(0,245,255,0.28)', // --cyan dashes
    goalMouth: '#06121a',
    goalBorder: '#f5ff00', // --yellow
    goalFrog: '#00ff88', // --green
    cars: ['#ff006e', '#f5ff00', '#00f5ff', '#ff5cc8'], // magenta/yellow/cyan/pink
    windshield: 'rgba(0,245,255,0.7)',
    wheel: '#15151f',
    truckTrailer: '#8a8fb5', // --ink-dim silver
    truckCab: '#ff006e', // --magenta
    log: '#9a6bff', // electric violet
    logGrain: 'rgba(40,20,80,0.7)',
    logRing: '#6b4ddb',
    turtleBody: '#00ff88', // --green
    turtleShell: '#00b35f',
    turtleSubmerged: 'rgba(0,255,136,0.4)',
    frogBody: '#b6ff00', // vivid lime to pop over the green river world
    frogLegs: '#39ff14',
    frogEye: '#fff',
    frogPupil: '#0a0a0f',
    hudScore: '#e6e9ff', // --ink
    hudLevel: '#00f5ff', // --cyan
    hudLife: '#39ff14',
    hudLifeEye: '#fff',
    timeBarHigh: '#00ff88', // --green
    timeBarMid: '#f5ff00', // --yellow
    timeBarLow: '#ff006e', // --magenta
    timeBarBg: 'rgba(10,10,15,0.6)',
    glow: 8,
  },
  // CRT / phosphor: warm amber + phosphor green over warm-dark backdrops.
  retro: {
    goalsRow: '#0b1a0b',
    river: '#0a2630', // dark teal water
    safe: '#101a0a',
    road: '#0b0900', // warm near-black
    laneLine: 'rgba(255,176,0,0.22)', // amber dashes
    goalMouth: '#06140a',
    goalBorder: '#ffb000', // amber phosphor
    goalFrog: '#39ff14', // bright phosphor green
    cars: ['#ff6b35', '#ffcf3a', '#9bff6a', '#ff3d3d'], // warm phosphor mix
    windshield: 'rgba(255,220,150,0.6)',
    wheel: '#1a1408',
    truckTrailer: '#c9b896', // warm metal
    truckCab: '#ff6b35', // phosphor orange
    log: '#9a6b2f', // warm wood/amber
    logGrain: 'rgba(60,38,10,0.7)',
    logRing: '#7a4f1f',
    turtleBody: '#39ff14', // phosphor green
    turtleShell: '#2bb80f',
    turtleSubmerged: 'rgba(57,255,20,0.4)',
    frogBody: '#9bff6a', // pale phosphor green
    frogLegs: '#39ff14',
    frogEye: '#fff',
    frogPupil: '#1a1408',
    hudScore: '#ffd27a', // warm amber
    hudLevel: '#39ff14', // phosphor green
    hudLife: '#9bff6a',
    hudLifeEye: '#fff',
    timeBarHigh: '#39ff14',
    timeBarMid: '#ffb000',
    timeBarLow: '#ff3d3d',
    timeBarBg: 'rgba(11,9,0,0.6)',
    glow: 5,
  },
};
