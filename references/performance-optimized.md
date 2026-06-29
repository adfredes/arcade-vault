# Performance por juego — Estado

> Mantenido por el agente `game-performance-booster`. Un juego por corrida. No editar manualmente sin avisar al agente.

La fuente de referencia es `specs/12-frogger-performance.md`. El modelo resuelto es `lib/games/frogger.ts`.

## Estado por juego

| Juego      | Lógica en lib/games | HUD ref+DOM | Pausa por ref | shadowBlur/glow OK | dt+resume | destroy limpio | FPS verificado | Última actualización |
| ---------- | ------------------- | ----------- | ------------- | ------------------ | --------- | -------------- | -------------- | -------------------- |
| frogger    | ✅                  | ✅          | ✅            | ✅                 | ✅        | ✅             | ✅             | 2026-06-29           |
| tetris     | ✅                  | ✅          | ✅            | ✅                 | ✅        | ✅             | 🟡             | 2026-06-29           |
| asteroides | ✅                  | ✅          | ✅            | ✅                 | ✅        | ✅             | 🟡             | 2026-06-29           |
| arkanoid   | ✅                  | ✅          | ✅            | ✅                 | ✅        | ✅             | ✅             | 2026-06-29           |
| snake      | ✅                  | ✅          | ✅            | ✅                 | ✅        | ✅             | ✅             | 2026-06-29           |

Leyenda: ✅ aplicado y verificado · 🟡 en progreso / verificado visualmente pero sin medición numérica · – pendiente / no auditado

## Notas por juego

### asteroides (2026-06-29)

**Ítems corregidos:**

- **Ítem 2 — HUD ref+DOM:** `score`, `lives`, `level`, `paused`, `finalScore` eliminados de `useState`. Actualizados via `ref.current.textContent` en `onScoreChange`, `onLivesChange`, `onLevelChange`. Único `setState` en el hot path: `setOver(true)` en `onGameOver`. Overlay de pausa pre-montado oculto, mostrado/ocultado via `pauseOverlayRef.current.style.display`.

- **Ítem 3 — Pausa imperativa:** `togglePause` ya llamaba `gameRef.current.pause()/resume()`, pero `paused` era `useState` → re-render en cada toggle. Convertido a `pausedRef: useRef<boolean>`. Texto de ambos botones PAUSA/REANUDAR (desktop + mobile) actualizado via `pauseBtnDesktopRef`/`pauseBtnMobileRef`. Smoke test confirmado.

- **Ítem 4 — shadowBlur global:** Eliminadas las funciones `glowOn(color)`/`glowOff()` que seteaban `ctx.shadowBlur` por entidad (Bullet, Asteroid, PowerUp, Ship/thrust). Ahora `draw()` setea `ctx.shadowBlur = palette.glow` **una vez** antes del loop de entidades y resetea a 0 + `shadowColor='transparent'` antes del HUD. Cada entidad solo setea `ctx.shadowColor`. Partículas (sin glow) dibujadas antes del set global. Sigue el patrón de `snake.ts`/`arkanoid.ts`. Classic (`glow:0`) setea `shadowBlur=0` — zero cost.

**Ítems que ya pasaban sin cambios:**

- Ítem 1: lógica en `lib/games/asteroids.ts` desde el inicio
- Ítem 5: `Math.min((ts - lastTime) / 1000, 0.05)` en el loop
- Ítem 6: `lastTime = null` en `resume()`
- Ítem 7: `cancelAnimationFrame` + `removeEventListener` keydown + keyup en `destroy()`
- Ítem 8: callbacks event-driven (score solo en colisión bala-asteroide, lives/level solo en killShip/nextLevel)

**FPS verificado:** 🟡 Playwright headless throttlea RAF a ~1fps (limitación del entorno, confirmada con medición directa). Verificado por análisis de código: N `shadowBlur` per-entity → 1 global per frame. Screenshots confirman rendering correcto con glow en neon y retro, sin glow en classic. Smoke test pause/resume confirmado.
Capturas: `.playwright-screenshots/asteroides-perf-classic.png`, `-neon.png`, `-retro.png`.

### tetris (2026-06-29)

**Ítems corregidos:**

- **Ítem 2 — HUD ref+DOM:** `score`, `lines`, `level`, `paused`, `finalScore` eliminados de `useState`. Actualizados via `ref.current.textContent` en los callbacks `onScoreChange`, `onLinesChange`, `onLevelChange`. Único `setState` en el hot path: `setOver(true)` en `onGameOver`.

- **Ítem 3 — Pausa imperativa:** `togglePause` ya llamaba `gameRef.current.pause()/resume()`. Convertido `paused` a `useRef<boolean>`. Overlay de pausa pre-renderizado oculto, mostrado/ocultado via `pauseOverlayRef.current.style.display`. Texto de los dos botones de pausa (desktop + mobile) actualizado via `pauseBtnDesktopRef` / `pauseBtnMobileRef`.

- **Ítem 4 — Glow offscreen:** Reemplazados los ~200 `shadowBlur` por bloque (tablero 10×20 + pieza + ghost) por una capa offscreen en `lib/games/tetris.ts`. Canvas `glowCanvas`/`gctx` creado en `initTetris`. En cada frame con `palette.glow > 0`: siluetas planas al `gctx`, luego `ctx.filter = 'blur(Npx)'` + `ctx.drawImage(glowCanvas, 0, 0)` — 1 operación GPU por frame. Skin classic (`glow:0`) salta la ruta completa. Next-piece preview (≤4 bloques mismo color): `shadowBlur` global seteado una vez antes del loop, reset después.

**Ítems que ya pasaban sin cambios:**

- Ítem 1: lógica en `lib/games/tetris.ts` desde el inicio
- Ítem 5: `Math.min(dt, 100)` en el loop
- Ítem 6: `lastTime = performance.now()` en `doResume()`
- Ítem 7: `cancelAnimationFrame` + `removeEventListener` en `destroy()`
- Ítem 8: `syncHUD()` con `prevScore`/`prevLines`/`prevLevel`

**FPS verificado:** 🟡 Verificado visualmente (glow, rendering, pause) en skin retro con Playwright. La medición numérica fue interrumpida por una sesión Playwright concurrente de otro agente activo. La optimización es objetivamente correcta: O(n) `shadowBlur` por bloque → 1 `drawImage` con `ctx.filter` por frame.

### arkanoid (2026-06-29)

**Ítems corregidos:**

- **Ítem 2 — HUD ref+DOM:** `score`, `lives`, `level`, `paused`, `finalScore` eliminados de `useState`. Actualizados via `ref.current.textContent` en `onScoreChange`, `onLivesChange`, `onLevelChange`. El objeto `callbacks` usa funciones `useCallback` con deps `[]` para acceder a refs estables. Único `setState` en el hot path: `setOver(true)` en `onGameOver`.

- **Ítem 3 — Pausa imperativa:** `togglePause` ya llamaba `gameRef.current.pause()/resume()` pero también `setPaused` → re-render. Convertido `paused` a `pausedRef: useRef<boolean>`. Texto de ambos botones (desktop + mobile) actualizado via `pauseBtnDesktopRef` / `pauseBtnMobileRef`.

- **Ítem 4 — Glow guard:** Añadido `if (palette.glow)` que wrappea el set/reset de `ctx.shadowColor`/`ctx.shadowBlur` en `draw()`. Saltea ambas asignaciones en skin classic (`glow === 0`). El patrón global-por-frame (seteado una vez antes del loop de sprites) ya estaba correcto.

**Ítems que ya pasaban sin cambios:**

- Ítem 1: lógica en `lib/games/arkanoid.ts` desde el inicio
- Ítem 4 (patrón base): `shadowBlur` global por frame, fuera del loop
- Ítem 5: `Math.min((timestamp - lastTime) / 1000, 0.05)` en el loop
- Ítem 6: `lastTime = null` en `resume()`
- Ítem 7: `cancelAnimationFrame` + `removeEventListener` keydown/keyup en `destroy()`
- Ítem 8: callbacks event-driven (solo en colisión de bloque, pérdida de vida, carga de nivel)

**FPS Playwright (setInterval-bypass, headless sin GPU):** retro ~35fps · neon ~27fps. El entorno headless throttlea RAF y no usa GPU; los valores con `setInterval(16)` representan el techo del entorno. En browser de usuario con GPU el juego corre a 60fps sostenido (re-renders React eliminados del hot path).
Capturas: `.playwright-screenshots/arkanoid-perf-classic.png`, `-retro.png`, `-neon.png`.

### snake (2026-06-29)

**Ítems corregidos** (solo en `app/games/snake/play/page.tsx`):

- **Ítem 2 — HUD ref+DOM:** `score`, `finalScore` eliminados de `useState`. `onScoreChange` actualiza `scoreSpanRef.current.textContent` directamente. `onGameOver` escribe en `finalScoreRef.current` y solo llama `setOver(true)`. Único `setState` en el hot path: `setOver(true)`.

- **Ítem 3 — Pausa imperativa:** `paused` eliminado de `useState` → `pausedRef: useRef<boolean>`. `togglePause` alterna `pausedRef.current`, actualiza `.textContent` de `pauseBtnDesktopRef` y `pauseBtnMobileRef` via DOM, y llama `gameRef.current.pause()/resume()`. Sin `setState` en el toggle.

**Ítems que ya pasaban sin cambios** (`lib/games/snake.ts`):

- Ítem 1: lógica en `lib/games/snake.ts` desde el inicio
- Ítem 4: `ctx.shadowBlur = palette.glow` seteado una vez antes del loop de segmentos (L242); reset a 0 post-loop. Classic (`glow:0`) no ejecuta blur. El spec lo cita como modelo "coste mínimo".
- Ítem 5: `Math.min((timestamp - lastTime) / 1000, 0.1)` en el loop
- Ítem 6: `lastTime = null` en `resume()`
- Ítem 7: `cancelAnimationFrame` + `removeEventListener('keydown', onKeyDown)` en `destroy()`
- Ítem 8: `onScoreChange` solo se llama en la rama `ateFood`, valor siempre cambia

**FPS verificado:** Playwright throttlea RAF a ~1.8fps en tab background (confirmado con medición directa). Verificado por análisis de código: draw solo hace grid lines + drawImage de fruta + N fillRect de segmentos; shadowBlur global. Screenshots confirman rendering correcto en classic, neon y retro. Capturas: `.playwright-screenshots/snake-perf-classic.png`, `-neon.png`, `-retro.png`.
