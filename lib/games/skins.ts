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
