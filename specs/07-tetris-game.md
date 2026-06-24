# 07-tetris-game

**Estado:** Implementado
**Dependencias:** 05-asteroides-game (patrón de integración canvas↔React), 06-leaderboard-supabase (tablas `games`/`scores`, `saveScore`)
**Fecha:** 2026-06-23
**Objetivo:** Integrar el juego Tetris como entrada propia en Arcade Vault, con canvas real, preview de pieza siguiente, HUD React sincronizado (score, líneas, nivel, pausa, game over) y guardado de puntajes en Supabase.

---

## Scope

### Dentro del scope

- `lib/games/tetris.ts` — módulo TS adaptado de `game.js`; exporta `initTetris(canvas, callbacks, nextCanvas?): TetrisController`
- `components/games/TetrisGame.tsx` — Client Component que monta ambos canvas (board + NEXT), llama a `initTetris` y hace de puente con la play page
- `app/games/tetris/play/page.tsx` — ruta estática, play page dedicada; HUD React (score, líneas, nivel, preview NEXT), botón PAUSA y modal de game over con guardado en Supabase
- Insertar fila en tabla `games` de Supabase con `id: 'tetris'`

### Fuera del scope

- Autenticación de usuarios
- Controles táctiles / mobile
- Guardado en localStorage (solo Supabase)
- Theme toggle claro/oscuro del juego original (la plataforma fija su propio tema)
- Responsive del canvas (fijo a 300×600px)
- Ranking en tiempo real / realtime

---

## Data Model

### Interfaz del módulo (`lib/games/tetris.ts`)

```ts
export interface TetrisCallbacks {
  onScoreChange: (score: number) => void;
  onLinesChange: (lines: number) => void;
  onLevelChange: (level: number) => void;
  onPauseChange: (paused: boolean) => void; // la tecla P alterna pausa internamente
  onGameOver: (finalScore: number) => void;
}

export interface TetrisController {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

// nextCanvas es opcional: si se pasa, el módulo dibuja ahí la pieza siguiente
export function initTetris(
  canvas: HTMLCanvasElement,
  callbacks: TetrisCallbacks,
  nextCanvas?: HTMLCanvasElement,
): TetrisController;
```

> `onPauseChange` existe porque la tecla `P` alterna la pausa dentro del módulo; React debe enterarse para mantener el botón PAUSA sincronizado.

### Fila en tabla `games` (Supabase)

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'tetris',
  'TETRIS',
  'Encaja las piezas y completa líneas.',
  'Las piezas caen sin descanso y tu misión es encajarlas para completar líneas horizontales. La velocidad sube a cada nivel y un solo hueco mal cerrado puede sellar tu destino. ¿Hasta qué nivel llegás?',
  'PUZZLE',
  'cover-tetro',
  'cyan'
);
```

> Las tablas `games`/`scores`, las RLS policies y los helpers `saveScore`/`getTopScores`/`getGameStats` ya existen (spec 06) — no se modifican. `cover-tetro` ya existe en `globals.css` — no se agrega regla nueva.

---

## Plan de implementación

1. **`lib/games/tetris.ts`** — adaptar `game.js` al módulo TypeScript:
   - Envolver toda la lógica en la factory `initTetris(canvas, callbacks, nextCanvas?)`
   - Reemplazar `document.getElementById('board')`/`getContext` por el parámetro `canvas`; ídem `nextCanvas` para el preview (si llega `undefined`, omitir `drawNext`)
   - Constantes `COLS=10, ROWS=20, BLOCK=30` ⇒ canvas 300×600; mover `COLORS`, `PIECES`, `LINE_SCORES` dentro del módulo
   - Estado del juego en variables de closure (no globales)
   - Eliminar todo lo del theme-toggle y su `localStorage` (fuera de scope)
   - Eliminar `updateHUD()` que escribe en `.textContent`; reemplazar por callbacks: `onScoreChange(score)` cuando cambia el score, `onLinesChange(lines)` y `onLevelChange(level)` cuando cambian
   - Listeners de teclado removibles:
     - Mover de `document.addEventListener` a `window.addEventListener`
     - `GAME_KEYS = { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Space }` ⇒ `e.preventDefault()` para evitar scroll de página (Space ya lo tenía)
     - `KeyP` alterna pausa interna y llama `onPauseChange(paused)`; `KeyX`/`ArrowUp` rotan
   - Reemplazar el overlay DOM de game over/pausa por callbacks: `endGame()` llama `onGameOver(score)` (no toca el DOM); el loop se auto-detiene en game over
   - Flag `paused` interno; `pause()` y `resume()` lo modifican, resetean `lastTime` y disparan/cancelan el RAF; `resume()` setea `lastTime = performance.now()`
   - Loop con acumulador (`dropAccum += dt` vs `dropInterval`, como el original); agregar **clamp de dt** (`dt = Math.min(dt, 100)` ms) para evitar saltos tras pausa/tab oculto
   - `destroy()` cancela el RAF pendiente (`cancelAnimationFrame(animId)`) y elimina los listeners de teclado
   - Retornar `{ pause, resume, destroy }`

2. **`components/games/TetrisGame.tsx`** — Client Component:
   - `'use client'`
   - `forwardRef<TetrisGameHandle, Props>` con handle `{ pause: () => void; resume: () => void }`
   - Props: `callbacks: TetrisCallbacks`
   - `canvasRef` (board) y `nextCanvasRef` (preview); `controllerRef` para el `TetrisController`
   - `useImperativeHandle` expone `pause()`/`resume()`
   - `useEffect(() => { ... }, [])` — monta `initTetris(canvasRef.current!, callbacks, nextCanvasRef.current ?? undefined)`, guarda el controller, cleanup `() => controller.destroy()`
   - `<canvas ref={canvasRef} width={300} height={600} style={{ display:'block', maxWidth:'100%' }} />` + `<canvas ref={nextCanvasRef} width={120} height={120} />` (el padre lo posiciona en el HUD)

3. **`app/games/tetris/play/page.tsx`** — play page dedicada:
   - `'use client'`
   - Estado React: `score`, `lines`, `level`, `paused`, `over`, `finalScore`, `playerName`, `saved`, `saving`, `gameKey`
   - Callbacks en `useCallback([])`; `onPauseChange` sincroniza el estado `paused` cuando se usa la tecla P
   - `gameRef = useRef<TetrisGameHandle>(null)`; botón PAUSA llama `gameRef.current?.pause()`/`resume()` y togglea `paused`
   - Restart: resetear estado React + `setGameKey(k => k + 1)` (remonta `<TetrisGame key={gameKey}>`)
   - `handleSave`: `saveScore('tetris', playerName, finalScore)` de `@/lib/supabase/saveScore`; gestiona `saving`/`saved`
   - HUD: SCORE, LINES, LEVEL, preview NEXT, botón PAUSA, botón SALIR
   - Shell CRT: clases `crt`, `crt-screen`, `crt-content`; `<TetrisGame>` dentro de `crt-content`
   - Modal de game over: input de nombre (max 10 chars, mayúsculas), botón guardar (deshabilitado mientras `saving`), JUGAR DE NUEVO, VOLVER AL VAULT

4. **Insertar fila en `games`** vía `mcp__supabase__execute_sql` (el INSERT del data model). `cover-tetro` ya existe — no se toca `globals.css`.

5. **Verificar TypeScript** — `tsc --noEmit` sin errores.

---

## Criterios de aceptación

- [ ] `/games/tetris` muestra la ficha del juego con título TETRIS y botón JUGAR AHORA
- [ ] `/games/tetris/play` carga sin errores y muestra el canvas 300×600 con el juego corriendo
- [ ] El HUD de React muestra SCORE, LINES y LEVEL sincronizados con el estado interno del canvas
- [ ] Completar una línea actualiza SCORE y LINES en el HUD en tiempo real
- [ ] Al acumular 10 líneas, LEVEL sube y la caída se acelera
- [ ] El preview NEXT muestra la pieza siguiente y se actualiza al aparecer cada pieza
- [ ] Las teclas `←` `→` mueven, `↓` baja, `↑`/`X` rotan, `Space` hace hard-drop
- [ ] `Space` y las flechas no hacen scroll de la página
- [ ] El botón PAUSA detiene el loop; REANUDAR lo reanuda
- [ ] La tecla `P` alterna la pausa y el botón PAUSA queda sincronizado con ese estado
- [ ] Al colisionar una pieza al aparecer, aparece el modal de game over con la puntuación final
- [ ] El modal permite ingresar nombre (max 10 chars, mayúsculas) y guardar en Supabase
- [ ] El score guardado aparece en el leaderboard lateral de `/games/tetris` al recargar
- [ ] El score guardado aparece en el Salón de la Fama al recargar
- [ ] JUGAR DE NUEVO reinicia desde cero (score 0, líneas 0, nivel 1)
- [ ] VOLVER AL VAULT navega a `/`
- [ ] La home (`/`) muestra Tetris en el mini-rail
- [ ] `/games` muestra Tetris en la grid
- [ ] `tsc --noEmit` sin errores
- [ ] Los juegos existentes (Asteroides) siguen funcionando sin errores de runtime

---

## Decisiones tomadas y descartadas

| Decisión                 | Elegida                                        | Descartada                                  | Razón                                                                    |
| ------------------------ | ---------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------ |
| Ruta del juego           | Estática `app/games/tetris/play/page.tsx`      | Dinámica `[id]/play/page.tsx`               | Aislamiento por juego; evita mezclar canvas con el placeholder genérico  |
| Comunicación juego→React | Callbacks en `initTetris`                      | Custom DOM events                           | Callbacks tipados, sin `addEventListener` en el componente               |
| Preview NEXT             | 2° canvas pasado al módulo (`nextCanvas?`)     | Callback `onNextChange` + redibujo en React | Mínimo cambio sobre el `game.js` original; reutiliza `drawNext` tal cual |
| Pausa                    | Botón React + tecla `P` (con `onPauseChange`)  | Solo botón React                            | Mantiene el control clásico de teclado sin perder el botón de plataforma |
| HUD                      | DOM→callbacks (React dibuja SCORE/LINES/LEVEL) | Mantener `.textContent` en el módulo        | El módulo no debe conocer el DOM de la plataforma                        |
| Reinicio                 | Remontar `<TetrisGame>` vía `key`              | Reusar `init()` interno                     | Estado limpio sin lógica extra en el módulo                              |
| Guardado de score        | Solo Supabase (`saveScore`)                    | localStorage                                | Persistencia real; infraestructura ya existente (spec 06)                |
| Clamp de dt              | Agregar `Math.min(dt, 100)`                    | Dejar el loop original sin clamp            | Evita que la pieza salte varias filas tras pausa o pestaña oculta        |

---

## Riesgos identificados

- **Loop zombie:** si `destroy()` no cancela el RAF pendiente, al remontar (JUGAR DE NUEVO) correrán dos loops. Mitigación: guardar `animId` y `cancelAnimationFrame` en `destroy()`.
- **Listeners de teclado huérfanos:** los listeners van a `window`. Si el componente se desmonta sin `destroy()`, capturan teclas en otras páginas. Mitigación: el cleanup del `useEffect` siempre llama `controller.destroy()`.
- **Pausa desincronizada:** la tecla `P` alterna pausa dentro del módulo; sin `onPauseChange` el botón PAUSA mostraría un estado erróneo. Mitigación: el módulo emite `onPauseChange(paused)` en cada toggle.
- **Conflicto ruta estática vs dinámica:** Next.js prioriza `app/games/tetris/play/page.tsx` sobre `[id]/play`. Verificar que `/games/tetris/play` resuelve al estático y los demás juegos siguen en el placeholder.
- **Canvas fuera de pantalla en viewports chicos:** fijo 300×600 (más angosto que Asteroides, bajo riesgo). Fuera de scope — documentado para spec futura de responsive.
