# 02-floodit-maraton

**Estado:** Borrador
**Dependencias:** 05-asteroides-game (patrón canvas↔React), 06-leaderboard-supabase (tablas `games`/`scores`, `saveScore`)
**Fecha:** 2026-06-29
**Objetivo:** Variante progresiva de Flood-It en Arcade Vault: cada tablero despejado genera uno nuevo con menos movimientos disponibles y un multiplicador de puntuación creciente, hasta que el jugador falle en completar un tablero.

---

## Scope

### Dentro del scope

- `lib/games/floodit.ts` — mismo id base; exporta `initFloodIt(canvas, callbacks): FloodItController`
- `components/games/FloodItGame.tsx` — Client Component; expone `pause`/`resume`/`pickColor`
- `app/games/floodit/play/page.tsx` — ruta estática; HUD con tablero actual, movimientos, score acumulado y modal de game over
- Insertar fila en tabla `games` de Supabase con `id: 'floodit'`

### Fuera del scope

- Autenticación de usuarios
- Controles táctiles / mobile
- Guardado de scores en localStorage (solo Supabase)
- Responsive del canvas (fijo a 560×560 px)
- Ranking en tiempo real / realtime
- Sonido
- Modal de victoria intermedio entre tableros (solo existe modal final de game over)

---

## Data Model

### Interfaz del módulo (`lib/games/floodit.ts`)

```ts
export interface FloodItCallbacks {
  onScoreChange: (score: number) => void;
  onMovesChange: (movesLeft: number) => void;
  onLevelChange: (level: number) => void;
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

### Progresión de tableros

| Tablero | Movimientos disponibles | Multiplicador de score |
| ------- | ----------------------- | ---------------------- |
| 1       | 25                      | ×1                     |
| 2       | 23                      | ×2                     |
| 3       | 21                      | ×3                     |
| 4       | 19                      | ×4                     |
| 5+      | max(13, 25 − (N−1)×2)   | ×N                     |

Score por tablero: `movesLeft × 100 × level`. El score se acumula a lo largo de todos los tableros.
Si el jugador agota los movimientos sin despejar el tablero actual, la partida termina.

### 1. `lib/games/floodit.ts` — módulo TypeScript desde cero

- Constantes: `const COLS = 14; const ROWS = 14; const CELL = 40; const W = 560; const H = 560; const NUM_COLORS = 6;`
- Paleta: `const PALETTE = ['#ff006e', '#00f5ff', '#f5ff00', '#00ff88', '#ff7700', '#aa00ff'];`
- Función `movesForLevel(level: number)`: `Math.max(13, 25 - (level - 1) * 2)`
- Estado en closures: `grid`, `playerRegion` (Set `"x,y"`), `playerColor`, `movesLeft`, `score` (acumulado), `level` (empieza en 1), `destroyed`, `over`
- `initGrid()`: llenar `grid` con índices aleatorios; registrar color de `[0,0]`; calcular `playerRegion` con BFS
- `floodFill(newColorIndex)`: BFS desde frontera de `playerRegion`; absorber celdas del color elegido; actualizar `playerColor`; decrementar `movesLeft`
- `checkWin()`: `playerRegion.size === COLS * ROWS`
- `drawGrid(ctx)`: dibujar celdas; diferenciar visualmente `playerRegion` con borde interno (`strokeRect` rgba(255,255,255,0.3)); mostrar número de tablero actual como texto pequeño en esquina superior derecha del canvas (`ctx.fillText`)
- `nextBoard()`: incrementar `level`; calcular `movesLeft = movesForLevel(level)`; reiniciar `grid` y `playerRegion` con nuevo tablero aleatorio; llamar `onLevelChange(level)` y `onMovesChange(movesLeft)`; redibujar
- `pickColor(colorIndex)`: ignorar si `colorIndex === playerColor || over || destroyed`; llamar `floodFill(colorIndex)`; llamar `onMovesChange(movesLeft)` y `onScoreChange(score)`; si `checkWin()` → sumar `movesLeft × 100 × level` a `score`; llamar `onScoreChange(score)`; llamar `nextBoard()`; sino si `movesLeft === 0` → `over = true`; `onGameOver(score)`; redibujar
- `pause()`, `resume()`: flag `paused` (sin RAF en esta variante)
- `destroy()`: `destroyed = true`; no hay RAF que cancelar
- Retornar `{ pause, resume, destroy, pickColor }`

### 2. `components/games/FloodItGame.tsx` — Client Component

- `'use client'`
- `forwardRef<FloodItGameHandle, Props>` con handle `{ pause(): void; resume(): void; pickColor(colorIndex: number): void }`
- Props: `callbacks: FloodItCallbacks`
- `useImperativeHandle` expone `pause`, `resume`, `pickColor`
- `useEffect(() => { ... }, [])` — monta `initFloodIt`, guarda controller, retorna cleanup `() => controller.destroy()`
- `<canvas ref={canvasRef} width={560} height={560} style={{ display: 'block', maxWidth: '100%' }} />`

### 3. `app/games/floodit/play/page.tsx` — play page dedicada

- `'use client'`
- Estado React: `score`, `movesLeft` (inicial `movesForLevel(1)`), `level` (inicial 1), `paused`, `over`, `finalScore`, `playerName`, `saved`, `saving`, `gameKey`
- Callbacks `onLevelChange(lv)` → `setLevel(lv)` y `setMovesLeft(movesForLevel(lv))`
- HUD superior: `TABLERO <level>`, `MOVIMIENTOS <movesLeft>`, `SCORE <score>`; botón PAUSA; botón SALIR
- HUD inferior: fila de 6 botones de color (`pickColor(i)`)
- Modal de game over al morir: "TABLERO <level> — SIN MOVIMIENTOS"; score final; input nombre; botones guardar / JUGAR DE NUEVO / VOLVER AL VAULT
- Restart: resetear estado + `setGameKey(k => k + 1)`
- Shell CRT: clases `crt`, `crt-screen`, `crt-content`

### 4. Insertar fila en `games`

Ejecutar INSERT vía `mcp__supabase__execute_sql`.

### 5. Verificar TypeScript

`tsc --noEmit` sin errores.

---

## Criterios de aceptación

- [ ] `/games/floodit` muestra la ficha del juego con título FLOOD-IT y botón JUGAR AHORA
- [ ] `/games/floodit/play` carga sin errores y muestra la grilla 14×14 con 6 colores
- [ ] La región inicial del jugador está visualmente diferenciada
- [ ] Los 6 botones de color en el HUD funcionan correctamente
- [ ] Al despejar el tablero 1, el tablero 2 aparece inmediatamente con `movesLeft = 23` y el HUD muestra `TABLERO 2`
- [ ] El score acumulado crece correctamente aplicando el multiplicador de nivel (`movesLeft × 100 × level`)
- [ ] El presupuesto de movimientos disminuye correctamente con cada nivel (`25, 23, 21…` con mínimo 13)
- [ ] Si el jugador agota los movimientos sin completar el tablero, aparece el modal de game over con el número de tablero alcanzado
- [ ] El botón PAUSA congela el estado (botones de color deshabilitados)
- [ ] El modal permite ingresar nombre (max 10 chars, mayúsculas) y guardar en Supabase
- [ ] El score guardado aparece en el leaderboard lateral y en el Salón de la Fama
- [ ] JUGAR DE NUEVO reinicia desde el tablero 1 con presupuesto 25
- [ ] VOLVER AL VAULT navega a `/`
- [ ] La home y `/games` muestran el juego en su lugar
- [ ] `tsc --noEmit` sin errores
- [ ] Los juegos existentes siguen funcionando sin errores de runtime

---

## Decisiones tomadas y descartadas

| Decisión                  | Elegida                                           | Descartada                       | Razón                                                                                                           |
| ------------------------- | ------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Ruta del juego            | Estática `app/games/floodit/play/page.tsx`        | Dinámica `[id]/play/page.tsx`    | Aislamiento por juego                                                                                           |
| Progresión                | Reducción de 2 movimientos por tablero, mínimo 13 | Aumentar número de colores       | Más intuitivo para el jugador; los colores adicionales añaden complejidad de percepción sin mecánica nueva      |
| Multiplicador de score    | `movesLeft × 100 × level`                         | Score fijo por tablero           | Incentiva llegar lejos Y jugar eficientemente en cada tablero                                                   |
| Transición entre tableros | Inmediata (siguiente tablero aparece sin pausa)   | Pantalla de intermedio           | Mantiene el ritmo; el HUD ya refleja el cambio de nivel                                                         |
| Modal de victoria final   | No existe — el juego es infinito hasta fallar     | Modal en cada tablero completado | Evitar interrupciones; el único hito narrativo es cuántos tableros resististe                                   |
| Sin RAF                   | Flag `destroyed` + redibuja solo en `pickColor`   | RAF constante                    | No hay animación continua; la variante maratón es estratégica, no de tiempo                                     |
| Enfoque de esta variante  | Progresión infinita con presupuesto decreciente   | Clásico una ronda / Contrarreloj | Para jugadores que buscan desafío y superación personal de tableros; score alto requiere dominar muchos niveles |

---

## Riesgos identificados

- **`destroy()` sin RAF:** El flag `destroyed` previene efectos secundarios si `pickColor` es invocado después del desmontaje del componente.

- **Grilla irresolvable en niveles altos:** Con 13 movimientos de mínimo, tableros aleatorios pueden ser prácticamente irresolubles. Mitigación: la misma heurística de validación de `01-floodit-clasica` (regenerar hasta 10 veces si el BFS estimado supera el presupuesto); en niveles extremos, el presupuesto es el reto y se asume imposible por definición del modo maratón.

- **Score desbordante en niveles muy altos:** `movesLeft (13) × 100 × N` para N grande puede producir scores de 6 dígitos. Compatible con `integer` de Supabase (máximo 2^31 − 1 ≈ 2.1 × 10⁹); sin riesgo.

- **Conflicto ruta estática vs dinámica:** Misma mitigación que variante 01.

- **Canvas fuera de pantalla:** Canvas fijo 560×560. Fuera de scope.

- **Texto del nivel en canvas:** `ctx.fillText` requiere cargar la fuente correcta. Usar `font: '12px monospace'` como fallback seguro; no depender de fuentes de Next.js que cargan async.
