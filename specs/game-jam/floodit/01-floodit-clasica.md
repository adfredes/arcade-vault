# 01-floodit-clasica

**Estado:** Borrador
**Dependencias:** 05-asteroides-game (patrón canvas↔React), 06-leaderboard-supabase (tablas `games`/`scores`, `saveScore`)
**Fecha:** 2026-06-29
**Objetivo:** Integrar Flood-It clásico en Arcade Vault: grilla 14×14 de 6 colores, 25 movimientos de presupuesto, botones de color en el HUD React y scoring por movimientos restantes.

---

## Scope

### Dentro del scope

- `lib/games/floodit.ts` — módulo TypeScript escrito desde cero; exporta `initFloodIt(canvas, callbacks): FloodItController`
- `components/games/FloodItGame.tsx` — Client Component que monta el canvas, llama a `initFloodIt`, y expone `pause`/`resume`/`pickColor` al padre
- `app/games/floodit/play/page.tsx` — ruta estática; HUD React con 6 botones de color, marcador de movimientos y modal de fin de partida con guardado en Supabase
- Insertar fila en tabla `games` de Supabase con `id: 'floodit'`

### Fuera del scope

- Autenticación de usuarios
- Controles táctiles / mobile
- Guardado de scores en localStorage (solo Supabase)
- Responsive del canvas (fijo a 560×560 px)
- Ranking en tiempo real / realtime
- Sonido
- Función de deshacer movimiento (undo)
- Modos multijugador o progresivos (ver variantes 02 y 03)

---

## Data Model

### Interfaz del módulo (`lib/games/floodit.ts`)

```ts
export interface FloodItCallbacks {
  onScoreChange: (score: number) => void;
  onMovesChange: (movesLeft: number) => void;
  onGameOver: (finalScore: number) => void;
  onWin: (finalScore: number) => void;
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

1. **`lib/games/floodit.ts`** — escribir el módulo TypeScript desde cero:
   - Constantes: `const COLS = 14; const ROWS = 14; const CELL = 40; const W = 560; const H = 560; const NUM_COLORS = 6; const MAX_MOVES = 25;`
   - Paleta de 6 colores: `const PALETTE = ['#ff006e', '#00f5ff', '#f5ff00', '#00ff88', '#ff7700', '#aa00ff'];`
   - Estado en closures: `grid` (array `COLS×ROWS` de índices 0-5), `playerRegion` (Set de claves `"x,y"`), `playerColor` (número 0-5), `movesLeft`, `score`, `destroyed`, `won`, `over`
   - `initGrid()`: llenar `grid` con índices aleatorios uniformes; registrar el color de la celda `[0,0]` como `playerColor`; calcular `playerRegion` con BFS desde `[0,0]` absorbiendo celdas contiguas del mismo color
   - `floodFill(newColorIndex)`: BFS desde las celdas frontera de `playerRegion` — absorber celdas adyacentes cuyo color sea `newColorIndex`; actualizar `grid` con `newColorIndex` para celdas absorbidas; actualizar `playerColor = newColorIndex`; decrementar `movesLeft`
   - `checkWin()`: `playerRegion.size === COLS * ROWS`
   - `drawGrid(ctx)`: `ctx.clearRect`; para cada celda dibujar `fillRect` con `PALETTE[grid[y][x]]`; las celdas en `playerRegion` reciben un sutil borde interior blanco (`strokeRect` 1px rgba(255,255,255,0.3)) para indicar la región del jugador
   - `pickColor(colorIndex)`: ignorar si `colorIndex === playerColor || over || destroyed`; llamar `floodFill(colorIndex)`; recalcular `score = movesLeft * 100`; llamar `onMovesChange(movesLeft)` y `onScoreChange(score)`; si `checkWin()` → `won = over = true`, `score += 500`, `onWin(score)`; sino si `movesLeft === 0` → `over = true`, `onGameOver(score)`; llamar `drawGrid(ctx)`
   - `pause()` y `resume()` operan sobre un flag `paused` (no afecta lógica en esta variante sin RAF; reservado para coherencia de la interfaz)
   - `destroy()`: marcar `destroyed = true` para ignorar llamadas futuras a `pickColor`; no hay RAF que cancelar
   - Sin listeners de teclado (el input es via botones React)
   - Retornar `{ pause, resume, destroy, pickColor }`

2. **`components/games/FloodItGame.tsx`** — Client Component:
   - `'use client'`
   - `forwardRef<FloodItGameHandle, Props>` con handle `{ pause(): void; resume(): void; pickColor(colorIndex: number): void }`
   - Props: `callbacks: FloodItCallbacks`
   - `canvasRef` para el `<canvas>`; `controllerRef` para el `FloodItController`
   - `useImperativeHandle` expone `pause`, `resume` y `pickColor` al padre
   - `useEffect(() => { ... }, [])` — monta `initFloodIt(canvasRef.current!, callbacks)`, guarda el controller, retorna `() => controller.destroy()` como cleanup
   - `<canvas ref={canvasRef} width={560} height={560} style={{ display: 'block', maxWidth: '100%' }} />`

3. **`app/games/floodit/play/page.tsx`** — play page dedicada:
   - `'use client'`
   - Estado React: `score`, `movesLeft` (inicial 25), `paused`, `over`, `won`, `finalScore`, `playerName`, `saved`, `saving`, `gameKey`
   - Callbacks en `useCallback([])` para estabilidad de referencia: `onScoreChange`, `onMovesChange`, `onGameOver`, `onWin`
   - `gameRef = useRef<FloodItGameHandle>(null)` para controlar `pickColor`/`pause`/`resume`
   - HUD superior: `score` y `movesLeft` en `hud-stat`; botón PAUSA; botón SALIR
   - HUD inferior (selector de colores): fila de 6 botones cuadrados (28×28 px) rellenos con cada color de la paleta; `onClick={() => gameRef.current?.pickColor(i)}`
   - Toggle de pausa: `gameRef.current?.pause()` / `gameRef.current?.resume()`
   - Restart: resetear estado React + `setGameKey(k => k + 1)` (remonta `<FloodItGame key={gameKey}>`)
   - `handleSave`: llama `saveScore('floodit', playerName, finalScore)` de `@/lib/supabase/saveScore`; gestiona estados `saving`/`saved`
   - Modal de victoria (`won === true`): mensaje "¡TABLERO INUNDADO!", score final resaltado, input de nombre (max 10 chars, mayúsculas), botón GUARDAR, JUGAR DE NUEVO, VOLVER AL VAULT
   - Modal de game over (`over && !won`): mensaje "SIN MOVIMIENTOS", score final, mismo flujo de guardado
   - Shell CRT: clases `crt`, `crt-screen`, `crt-content`; `<FloodItGame>` va dentro de `crt-content`

4. **Insertar fila en `games`**:
   - Ejecutar el INSERT de Supabase vía MCP (`mcp__supabase__execute_sql`)

5. **Verificar TypeScript** — `tsc --noEmit` sin errores.

---

## Criterios de aceptación

- [ ] `/games/floodit` muestra la ficha del juego con título FLOOD-IT y botón JUGAR AHORA
- [ ] `/games/floodit/play` carga sin errores y muestra el canvas con la grilla de 14×14 celdas en 6 colores
- [ ] La región inicial del jugador (esquina superior izquierda) está visualmente diferenciada en el canvas
- [ ] Los 6 botones de color en el HUD permiten elegir el color del turno
- [ ] La región del jugador se expande correctamente al seleccionar el color de celdas adyacentes
- [ ] Seleccionar el mismo color que el actual no consume movimiento (se ignora el click)
- [ ] El HUD muestra los movimientos restantes actualizados después de cada turno
- [ ] El HUD muestra el score actualizado (movesLeft × 100)
- [ ] Al cubrir todo el tablero aparece el modal de victoria con score final (incluye +500 bonus)
- [ ] Al agotar los 25 movimientos sin completar aparece el modal de game over
- [ ] El botón PAUSA congela el estado visual (botones de color deshabilitados)
- [ ] El modal permite ingresar nombre (max 10 chars, mayúsculas) y guardar en Supabase
- [ ] El score guardado aparece en el leaderboard lateral de `/games/floodit` al recargar
- [ ] El score guardado aparece en el Salón de la Fama al recargar
- [ ] JUGAR DE NUEVO reinicia el juego con una grilla aleatoria nueva (score 0, movimientos 25)
- [ ] VOLVER AL VAULT navega a `/`
- [ ] La home (`/`) muestra el juego en el mini-rail
- [ ] `/games` muestra el juego en la grid
- [ ] `tsc --noEmit` sin errores
- [ ] Los juegos existentes (Asteroides, Tetris, Arkanoid, Snake) siguen funcionando sin errores de runtime

---

## Decisiones tomadas y descartadas

| Decisión                 | Elegida                                    | Descartada                       | Razón                                                                                             |
| ------------------------ | ------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------- |
| Ruta del juego           | Estática `app/games/floodit/play/page.tsx` | Dinámica `[id]/play/page.tsx`    | Aislamiento por juego; evita mezclar lógica con el placeholder genérico                           |
| Bucle de animación       | Sin RAF (redibuja solo en `pickColor`)     | RAF constante                    | Flood-It no tiene animación continua; RAF sería overhead innecesario                              |
| Input del jugador        | Botones React en HUD                       | Click directo en canvas          | Los botones son inequívocos visualmente y reutilizan el sistema de estilos `.btn`                 |
| Tamaño de grilla         | 14×14, 6 colores                           | 12×12 5 colores                  | Dimensión canónica de Flood-It; dificultad correcta para 25 movimientos                           |
| Scoring                  | `movesLeft × 100 + 500 bonus en victoria`  | Binario win/lose                 | Incentiva jugar eficientemente; encaja con el leaderboard de puntuación numérica de la plataforma |
| Región del jugador       | Set de claves `"x,y"`                      | Array bidimensional de booleanos | El Set permite lookups O(1) y se itera limpiamente sin índices dobles                             |
| Comunicación juego→React | Callbacks en `initFloodIt`                 | Eventos DOM                      | Los callbacks son tipados y no requieren `addEventListener` en el componente                      |
| Enfoque de esta variante | Clásico, una ronda, presupuesto fijo       | Maratón / Contrarreloj           | Variante de entrada al juego; reglas directas, ideal para jugadores nuevos y primer leaderboard   |

---

## Riesgos identificados

- **`destroy()` sin RAF:** No hay RAF que cancelar, pero `pickColor` puede ser llamado con delay (debounce del DOM). El flag `destroyed` previene efectos secundarios post-desmontaje.

- **Grilla irresolvable:** Una grilla generada aleatoriamente puede ser demasiado fragmentada para resolver en 25 movimientos, frustrando al jugador. Mitigación: validar en `initGrid()` que la solución óptima estimada (heurística BFS) no excede 25 movimientos; regenerar hasta 10 veces si falla.

- **Conflicto ruta estática vs dinámica:** Next.js da prioridad a `app/games/floodit/play/page.tsx` sobre `app/games/[id]/play/page.tsx`. Verificar que `/games/floodit/play` resuelve al archivo estático y que los demás juegos siguen usando el placeholder dinámico.

- **Canvas fuera de pantalla en viewports pequeños:** El canvas es fijo 560×560 px. En pantallas más chicas desborda. Fuera de scope — documentado para spec futura de responsive/scaling.

- **Highlight de región del jugador:** El borde interior blanco sobre celdas de la región puede ser sutil y difícil de ver sobre colores claros (amarillo, cian). Alternativa: usar `filter: brightness(1.3)` o un efecto de borde exterior. Evaluar en `tsc` visual antes de merge.
