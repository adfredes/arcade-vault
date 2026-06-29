# 03-floodit-contrarreloj

**Estado:** Borrador
**Dependencias:** 05-asteroides-game (patrón canvas↔React), 06-leaderboard-supabase (tablas `games`/`scores`, `saveScore`)
**Fecha:** 2026-06-29
**Objetivo:** Variante de Flood-It contra el reloj en Arcade Vault: un temporizador de 90 segundos reemplaza el límite de movimientos; el jugador completa tantos tableros de 10×10 como pueda antes de que el tiempo se agote, compitiendo por el score más alto.

---

## Scope

### Dentro del scope

- `lib/games/floodit.ts` — mismo id base; exporta `initFloodIt(canvas, callbacks): FloodItController`
- `components/games/FloodItGame.tsx` — Client Component; expone `pause`/`resume`/`pickColor`
- `app/games/floodit/play/page.tsx` — ruta estática; HUD con cronómetro regresivo, tableros completados, score y selector de colores
- Insertar fila en tabla `games` de Supabase con `id: 'floodit'`

### Fuera del scope

- Autenticación de usuarios
- Controles táctiles / mobile
- Guardado de scores en localStorage (solo Supabase)
- Responsive del canvas (fijo a 500×500 px)
- Ranking en tiempo real / realtime
- Sonido
- Pausa (pausar el reloj daría ventaja competitiva; el botón PAUSA existe pero solo oscurece el canvas sin detener el timer)

---

## Data Model

### Interfaz del módulo (`lib/games/floodit.ts`)

```ts
export interface FloodItCallbacks {
  onScoreChange: (score: number) => void;
  onTimeChange: (secondsLeft: number) => void;
  onBoardsChange: (boardsCleared: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface FloodItController {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  pickColor: (colorIndex: number) => void;
}

export function initFloodIt(
  canvas: HTMLCanvasElement,
  callbacks: FloodItCallbacks,
): FloodItController;
```

### Fila en tabla `games` (Supabase)

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'floodit',
  'FLOOD-IT',
  'Inunda el tablero de un solo color antes de quedarte sin turnos.',
  'Empezás desde la esquina superior izquierda con un color inicial. Cada turno elegís un nuevo color: tu región se expande absorbiendo todas las celdas adyacentes de ese color. Ganás cuando todo el tablero es del mismo color; perdés si se agotan los movimientos.',
  'PUZZLE',
  'cover-glot',
  'magenta'
);
```

> Las tablas `games` y `scores`, las RLS policies, y los helpers `saveScore`/`getTopScores`/`getGameStats` ya existen (spec 06) — no se modifican.

---

## Plan de implementación

### Mecánica central

- Tablero: 10×10 celdas, 5 colores, canvas 500×500 px (CELL = 50 px)
- Tiempo: 90 segundos fijos, sin límite de movimientos por tablero
- Al despejar un tablero: `boardsCleared++`; score `+= 300`; nuevo tablero aleatorio inmediato
- Al expirar el tiempo: score final `+= celdas en playerRegion del tablero actual × 2`; `onGameOver(score)`
- Pausa: oscurece el canvas con overlay semitransparente; el timer NO se detiene (la mecánica competitiva no permite pausa real)

### 1. `lib/games/floodit.ts` — módulo TypeScript desde cero

- Constantes: `const COLS = 10; const ROWS = 10; const CELL = 50; const W = 500; const H = 500; const NUM_COLORS = 5; const TOTAL_TIME = 90;`
- Paleta (5 colores): `const PALETTE = ['#ff006e', '#00f5ff', '#f5ff00', '#00ff88', '#ff7700'];`
- Estado en closures: `grid`, `playerRegion` (Set `"x,y"`), `playerColor`, `timeLeft` (segundos, empieza en `TOTAL_TIME`), `score` (acumulado), `boardsCleared`, `lastTime` (timestamp para RAF), `rafId`, `destroyed`, `over`, `paused`
- `initGrid()`: llenar `grid` con índices aleatorios 0-4; calcular `playerRegion` BFS desde `[0,0]`; registrar `playerColor`
- `floodFill(newColorIndex)`: BFS desde frontera de `playerRegion`; absorber celdas adyacentes del color elegido; actualizar `playerColor`
- `checkWin()`: `playerRegion.size === COLS * ROWS`
- `drawGrid(ctx)`: dibujar 100 celdas coloreadas; highlight de `playerRegion` con `strokeRect` rgba(255,255,255,0.25); barra de tiempo en la parte inferior del canvas (rect proporcional a `timeLeft/TOTAL_TIME`, color degradado verde→amarillo→rojo)
- **Loop RAF** (a diferencia de variantes 01 y 02, esta tiene RAF por el timer):
  - `loop(ts: number)`: calcular `dt = (ts - lastTime) / 1000`; clampear `dt = Math.min(dt, 0.1)`; `lastTime = ts`
  - Si `!paused && !over`: `timeLeft -= dt`; si `timeLeft <= 0` → `timeLeft = 0`; finalizar partida; si `Math.floor(timeLeft)` cambió respecto al tick anterior, `onTimeChange(Math.floor(timeLeft))`
  - Llamar `drawGrid(ctx)` en cada frame
  - Si `!over`: `rafId = requestAnimationFrame(loop)`
- `pickColor(colorIndex)`: ignorar si `colorIndex === playerColor || over || destroyed || paused`; llamar `floodFill(colorIndex)`; si `checkWin()` → `boardsCleared++`; `score += 300`; `onBoardsChange(boardsCleared)`; `onScoreChange(score)`; reiniciar `grid`+`playerRegion`; si no ganó, solo redibujar (el RAF ya lo hace en el próximo frame)
- `finalizarPartida()`: `over = true`; score parcial `+= playerRegion.size * 2`; `onScoreChange(score)`; `onGameOver(score)`; `cancelAnimationFrame(rafId)`
- `pause()`: `paused = true`; dibujar overlay semitransparente sobre el canvas
- `resume()`: `paused = false`; `lastTime = performance.now()` (resetear para evitar spike de dt tras pausa)
- `destroy()`: `destroyed = true`; `cancelAnimationFrame(rafId)`
- Sin listeners de teclado
- Retornar `{ pause, resume, destroy, pickColor }`

### 2. `components/games/FloodItGame.tsx` — Client Component

- `'use client'`
- `forwardRef<FloodItGameHandle, Props>` con handle `{ pause(): void; resume(): void; pickColor(colorIndex: number): void }`
- Props: `callbacks: FloodItCallbacks`
- `useImperativeHandle` expone `pause`, `resume`, `pickColor`
- `useEffect(() => { ... }, [])` — monta `initFloodIt`, guarda controller, retorna `() => controller.destroy()`
- `<canvas ref={canvasRef} width={500} height={500} style={{ display: 'block', maxWidth: '100%' }} />`

### 3. `app/games/floodit/play/page.tsx` — play page dedicada

- `'use client'`
- Estado React: `score`, `timeLeft` (inicial 90), `boardsCleared` (inicial 0), `paused`, `over`, `finalScore`, `playerName`, `saved`, `saving`, `gameKey`
- Callbacks en `useCallback([])`: `onScoreChange`, `onTimeChange`, `onBoardsChange`, `onGameOver`
- HUD superior: `⏱ <timeLeft>s` en neon-magenta cuando `timeLeft <= 10`; `TABLEROS <boardsCleared>`; `SCORE <score>`; botón PAUSA (oscurece, no detiene timer); botón SALIR
- HUD inferior: fila de 5 botones de color (paleta reducida); `disabled` cuando `over`
- Modal de game over: "TIEMPO AGOTADO"; tableros completados; score final; input nombre; botones guardar / JUGAR DE NUEVO / VOLVER AL VAULT
- Restart: resetear estado + `setGameKey(k => k + 1)`
- Shell CRT: clases `crt`, `crt-screen`, `crt-content`

### 4. Insertar fila en `games`

Ejecutar INSERT vía `mcp__supabase__execute_sql`.

### 5. Verificar TypeScript

`tsc --noEmit` sin errores.

---

## Criterios de aceptación

- [ ] `/games/floodit` muestra la ficha del juego con título FLOOD-IT y botón JUGAR AHORA
- [ ] `/games/floodit/play` carga sin errores y muestra la grilla 10×10 con 5 colores
- [ ] El temporizador de 90 segundos empieza a correr en cuanto carga la página
- [ ] Los 5 botones de color en el HUD permiten elegir el color del turno
- [ ] La región del jugador se expande correctamente al seleccionar colores adyacentes
- [ ] La barra de tiempo en el canvas se actualiza visualmente cada frame (verde → amarillo → roja)
- [ ] Al cubrir el tablero completo, el contador de tableros sube y aparece uno nuevo inmediatamente
- [ ] El score suma 300 por cada tablero completado
- [ ] Al expirar el tiempo aparece el modal "TIEMPO AGOTADO" con score final (incluyendo bonus de celdas parciales)
- [ ] El HUD muestra el cronómetro en neon-magenta cuando quedan ≤10 segundos
- [ ] El botón PAUSA oscurece el canvas pero el timer sigue corriendo (comportamiento documentado)
- [ ] El modal permite ingresar nombre (max 10 chars, mayúsculas) y guardar en Supabase
- [ ] El score guardado aparece en el leaderboard lateral y en el Salón de la Fama
- [ ] JUGAR DE NUEVO reinicia con timer 90s, tableros 0, score 0
- [ ] VOLVER AL VAULT navega a `/`
- [ ] La home y `/games` muestran el juego en su lugar
- [ ] `tsc --noEmit` sin errores
- [ ] Los juegos existentes siguen funcionando sin errores de runtime

---

## Decisiones tomadas y descartadas

| Decisión                  | Elegida                                          | Descartada                         | Razón                                                                                              |
| ------------------------- | ------------------------------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| Ruta del juego            | Estática `app/games/floodit/play/page.tsx`       | Dinámica `[id]/play/page.tsx`      | Aislamiento por juego                                                                              |
| Mecánica de límite        | Tiempo (90 s), sin límite de movimientos         | Movimientos fijos como variante 01 | Diferenciación sustantiva: presión de tiempo vs presión de eficiencia                              |
| Tamaño de grilla          | 10×10, 5 colores                                 | 14×14, 6 colores                   | Tableros más pequeños se completan más rápido, permitiendo más rondas en 90 s y score más dinámico |
| Pausa real                | No — timer corre siempre                         | Pausa real que frena el timer      | Coherencia competitiva para el leaderboard; pausar daría ventaja injusta                           |
| Bonus parcial al expirar  | `playerRegion.size × 2`                          | Solo score de tableros completos   | Recompensa progresos parciales; reduce frustración por diferencias de un segundo                   |
| Barra de tiempo en canvas | Rect proporcional al fondo del canvas            | Solo HUD React con número          | Feedback visual más inmediato durante el juego sin levantar la vista del canvas                    |
| Loop RAF                  | Necesario (timer corre en módulo TS)             | Timer en `setInterval` de React    | El módulo TS controla el tiempo internamente; evita desincronías con el estado React               |
| Enfoque de esta variante  | Contrarreloj, tableros pequeños, ritmo frenético | Clásico / Maratón                  | Para jugadores que buscan adrenalina y speed-running; score refleja cuántos tableros caben en 90 s |

---

## Riesgos identificados

- **Loop zombie:** Si `destroy()` no cancela el RAF, al remontar el componente (JUGAR DE NUEVO) correrán dos loops con timers separados. Mitigación: guardar `rafId` y llamar `cancelAnimationFrame(rafId)` en `destroy()`.

- **`lastTime` al reanudar pausa:** Si `resume()` no resetea `lastTime`, el próximo frame acumulará todo el tiempo pausado como dt, consumiendo segundos instantáneamente. Mitigación: `resume()` siempre reasigna `lastTime = performance.now()`.

- **Conflicto ruta estática vs dinámica:** Misma mitigación que variantes 01 y 02.

- **Canvas fuera de pantalla:** Canvas fijo 500×500. Fuera de scope.

- **Percepción de la pausa sin timer detenido:** El usuario puede confundirse al notar que el tiempo corre mientras el canvas está oscurecido. Mitigación: el botón PAUSA muestra un texto claro ("⏸ TIMER ACTIVO") y la documentación en el HUD señala que es una pausa visual.

- **Grilla irresolvable en 10×10:** Con 5 colores y tableros pequeños la probabilidad de grillas muy fragmentadas es mayor. Aplicar la misma heurística de validación BFS de variante 01; si el tablero estimado requiere más de 20 movimientos, regenerar.
