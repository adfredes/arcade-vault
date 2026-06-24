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
