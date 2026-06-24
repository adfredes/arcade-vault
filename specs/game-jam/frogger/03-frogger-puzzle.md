# 03-frogger-puzzle

**Estado:** Borrador
**Dependencias:** 05-asteroides-game (patrón de integración canvas↔React), 06-leaderboard-supabase (tablas `games`/`scores`, `saveScore`)
**Fecha:** 2026-06-24
**Objetivo:** Integrar Frogger como un puzzle de cruce **por turnos**: el tráfico avanza un paso solo cuando la rana se mueve (modelo lockstep, sin tiempo real continuo). Cada tablero es un nivel resoluble con un presupuesto de movimientos y casas de color que exigen llevar la rana correcta a su destino. El score premia la **eficiencia** (resolver con pocos movimientos) en vez de los reflejos. Esta variante prioriza el pensamiento estratégico y se diferencia de cualquier juego de timing del catálogo.

---

## Scope

### Dentro del scope

- `lib/games/frogger.ts` — módulo TypeScript escrito desde cero; exporta `initFrogger(canvas, callbacks): FroggerController`
- `components/games/FroggerGame.tsx` — Client Component que monta el canvas, llama a `initFrogger`, y hace de puente entre el módulo y la play page
- `app/games/frogger/play/page.tsx` — ruta estática, play page dedicada; incluye HUD React (score, nivel, movimientos restantes, casas por color), botón pausa y modal de game over con guardado en Supabase
- Insertar fila en tabla `games` de Supabase con id `frogger`

### Fuera del scope

- Autenticación de usuarios
- Controles táctiles / mobile
- Guardado de scores en localStorage (solo Supabase)
- Responsive del canvas (fijo a 520×600 px)
- Ranking en tiempo real / realtime
- Sonido
- Sprites con assets externos (formas/colores del canvas, estética neón CRT)
- Editor de niveles (los tableros son fijos, definidos como datos dentro del módulo)
- Animación interpolada del tráfico (el movimiento es a saltos discretos por tick; opcionalmente se interpola visualmente, pero la lógica es por celda)

---

## Data Model

### Interfaz del módulo (`lib/games/frogger.ts`)

```ts
export interface FroggerCallbacks {
  onScoreChange: (score: number) => void;
  onLevelChange: (level: number) => void;
  onMovesChange: (movesLeft: number) => void; // presupuesto de movimientos del nivel
  onCargoChange: (delivered: number, total: number) => void; // ranas entregadas a su casa
  onGameOver: (finalScore: number) => void; // sin movimientos o atropellada y sin retries
}

export interface FroggerController {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

export function initFrogger(
  canvas: HTMLCanvasElement,
  callbacks: FroggerCallbacks,
): FroggerController;
```

> No hay timer ni `onLivesChange`: el reto es el presupuesto de movimientos (`onMovesChange`) y entregar la carga correcta (`onCargoChange`). El tráfico no se mueve por tiempo, sino por turno.

### Fila en tabla `games` (Supabase)

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'frogger',
  'FROGGER',
  'Cruza pensando: el tráfico solo se mueve cuando vos.',
  'Un Frogger por turnos: cada salto que das hace avanzar un paso a todos los vehículos y troncos. Planeá la ruta, esquivá las colisiones y llevá cada rana a la casa de su color, todo dentro de un presupuesto de movimientos. Cuanto más limpio resolvés el tablero, más puntos ganás.',
  'ARCADE',
  'cover-rana',
  'green'
);
```

> Las tablas `games` y `scores`, las RLS policies, y los helpers `saveScore`/`getTopScores`/`getGameStats` ya existen (spec 06) — no se modifican. `cover-rana` ya existe en `globals.css` — no se agrega regla nueva.

---

## Plan de implementación

1. **`lib/games/frogger.ts`** — escribir el módulo TypeScript desde cero:
   - Geometría: `const COLS = 13; const CELL = 40; const ROWS = 15;` ⇒ canvas `W = 520`, `H = 600`. Distribución por filas igual a la clásica (casas / río / mediana / carretera / inicio), pero la dinámica es **por turnos**.
   - **Datos de niveles inline:** constante `LEVELS` con una lista de tableros. Cada tablero define: `moveBudget`, carriles (`{ row, type, dir, step, pattern[] }` donde `pattern` es la disposición inicial de obstáculos/plataformas en celdas), casas de color `{ col, color }`, y la(s) rana(s) de cada color en la acera de inicio. Cada nivel está diseñado para ser **resoluble** con el presupuesto dado.
   - Estado en variables de closure (no globales): `frog {col, row, color}`, `level`, `score`, `movesLeft`, `delivered`, `total`, `lanes` (estado actual de cada carril), `pendingFrogs` (ranas de color por entregar), `paused`, `dead`, `solved`.
   - **Modelo lockstep (por turnos):** el bucle **no** avanza el tráfico con `dt`. Cuando el jugador pulsa una flecha:
     1. Resolver el movimiento de la rana (a la celda adyacente o quedarse; debe ser válido — no salir del tablero).
     2. `movesLeft--`, `onMovesChange`.
     3. Avanzar **un tick** todos los carriles: cada obstáculo/plataforma se desplaza `step * dir` celdas (con wrap). Si la rana está sobre un tronco/tortuga, se mueve con él en este tick.
     4. Chequear colisiones tras el tick: auto sobre la celda de la rana = fallo; rana en celda de río sin plataforma = fallo. Un fallo reinicia el tablero actual al estado inicial (retry) sin coste de score-de-eficiencia adicional, pero descuenta los movimientos ya gastados solo si se elige así (decisión: el retry **restaura** `movesLeft` del nivel para mantener el foco en el puzzle).
   - **Entrega de carga:** llevar la rana a una casa cuyo color coincide ⇒ `delivered++`, `onCargoChange(delivered, total)`, `+100`, y se reaparece la siguiente `pendingFrog` (de su color) en la acera. Casa de color incorrecto = movimiento inválido (no entra) o penalización leve (decisión: simplemente no acepta la entrega).
   - **Fin de nivel (solved):** todas las casas correctas cubiertas ⇒ bonus de eficiencia `+ (movesLeft * 25)` + bonus base de nivel, `onScoreChange`, `level++`, `onLevelChange`, cargar el siguiente tablero de `LEVELS`. Al terminar el último nivel, repetir con presupuestos más ajustados (loop de dificultad) o marcar victoria con `onGameOver(score)` (decisión: bucle de dificultad para mantener el leaderboard abierto).
   - **Game over:** `movesLeft === 0` con el tablero sin resolver ⇒ `dead = true`, `onGameOver(score)`.
   - **Render:** el RAF se usa solo para dibujar (y, opcionalmente, interpolar visualmente el último tick para suavidad); la lógica nunca depende del tiempo real. Mantener un loop RAF liviano con **clamp de dt** para la interpolación, pero el estado autoritativo cambia por evento de teclado.
   - Listeners de teclado removibles: `window.addEventListener('keydown', handler)`; `GAME_KEYS = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'])` con `e.preventDefault()`. Ignorar `e.repeat` (un tick por pulsación) e ignorar nuevas teclas mientras una interpolación de tick está en curso (cola de un solo movimiento).
   - Flag `paused` interno; `pause()` lo activa, `resume()` lo desactiva y resetea `lastTime = null`.
   - `destroy()` cancela el RAF pendiente (`cancelAnimationFrame(rafId)`) y elimina el listener de teclado.
   - Retornar `{ pause, resume, destroy }`.

2. **`components/games/FroggerGame.tsx`** — Client Component:
   - `'use client'`
   - `forwardRef<FroggerGameHandle, Props>` con handle `{ pause: () => void; resume: () => void }`
   - Props: `callbacks: FroggerCallbacks`
   - `canvasRef` para el `<canvas>`; `controllerRef` para el `FroggerController`
   - `useImperativeHandle` expone `pause()` y `resume()` al padre
   - `useEffect(() => { ... }, [])` — monta `initFrogger(canvasRef.current!, callbacks)`, guarda el controller, retorna `() => controller.destroy()` como cleanup
   - `<canvas ref={canvasRef} width={520} height={600} style={{ display: 'block', maxWidth: '100%' }} />`

3. **`app/games/frogger/play/page.tsx`** — play page dedicada:
   - `'use client'`
   - Estado React: `score`, `level`, `movesLeft`, `delivered`, `total`, `paused`, `over`, `finalScore`, `playerName`, `saved`, `saving`, `gameKey`
   - Callbacks en `useCallback([])` para estabilidad de referencia
   - `gameRef = useRef<FroggerGameHandle>(null)` para controlar pausa/resume
   - Toggle de pausa: `gameRef.current?.pause()` / `gameRef.current?.resume()`
   - Restart: resetear estado React + `setGameKey(k => k + 1)` (remonta `<FroggerGame key={gameKey}>`)
   - `handleSave`: llama `saveScore('frogger', playerName, finalScore)` de `@/lib/supabase/saveScore`; gestiona estados `saving`/`saved`
   - HUD: SCORE, NIVEL, MOVIMIENTOS restantes, CARGA (delivered/total), botón PAUSA, botón SALIR
   - Shell CRT: clases `crt`, `crt-screen`, `crt-content`; `<FroggerGame>` va dentro de `crt-content`
   - Modal de game over: input de nombre (max 10 chars, mayúsculas), botón guardar (deshabilitado mientras `saving`), JUGAR DE NUEVO, VOLVER AL VAULT

4. **Insertar fila en `games`**:
   - Ejecutar el INSERT de Supabase vía MCP (`mcp__supabase__execute_sql`)

5. **Verificar TypeScript** — `tsc --noEmit` sin errores.

---

## Criterios de aceptación

- [ ] `/games/frogger` muestra la ficha del juego con título FROGGER y botón JUGAR AHORA
- [ ] `/games/frogger/play` carga sin errores y muestra el canvas 520×600 con el juego corriendo
- [ ] El HUD de React muestra SCORE, NIVEL, MOVIMIENTOS y CARGA (delivered/total) sincronizados con el estado interno del canvas
- [ ] El tráfico y los troncos **solo** avanzan cuando la rana se mueve (modelo por turnos); en reposo el tablero está quieto
- [ ] Cada pulsación de flecha cuenta como un movimiento y descuenta del presupuesto
- [ ] Las flechas mueven la rana de a una celda por pulsación, sin scroll de página
- [ ] Una colisión (auto sobre la rana o caer al agua) reinicia el tablero al estado inicial restaurando el presupuesto
- [ ] Llevar una rana a la casa de su color la entrega, suma score y aparece la siguiente rana pendiente
- [ ] Una casa de color incorrecto no acepta la entrega
- [ ] Completar todas las casas correctas resuelve el nivel, otorga bonus de eficiencia por movimientos sobrantes y carga el siguiente tablero
- [ ] Quedarse sin movimientos con el tablero sin resolver provoca game over
- [ ] El botón PAUSA detiene la interpolación/render; REANUDAR lo reanuda
- [ ] Al perder aparece el modal de game over con la puntuación final
- [ ] El modal permite ingresar nombre (max 10 chars, mayúsculas) y guardar en Supabase
- [ ] El score guardado aparece en el leaderboard lateral de `/games/frogger` al recargar
- [ ] El score guardado aparece en el Salón de la Fama al recargar
- [ ] JUGAR DE NUEVO reinicia el juego desde cero (score 0, nivel 1, primer tablero)
- [ ] VOLVER AL VAULT navega a `/`
- [ ] La home (`/`) muestra el juego en el mini-rail
- [ ] `/games` muestra el juego en la grid
- [ ] `tsc --noEmit` sin errores
- [ ] Los juegos existentes (Asteroides, Tetris, Arkanoid, Snake) siguen funcionando sin errores de runtime

---

## Decisiones tomadas y descartadas

| Decisión                 | Elegida                                                     | Descartada                                | Razón                                                                                        |
| ------------------------ | ----------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| Enfoque de esta variante | Puzzle por turnos (lockstep) con presupuesto de movimientos | Arcade en tiempo real (clásica / endless) | Convierte el cruce/timing en estrategia; mejor para quien prefiere pensar antes que reflejos |
| Avance del tráfico       | Un tick por movimiento de la rana (lockstep)                | Tiempo real continuo                      | Es la diferencia mecánica radical respecto a todo el catálogo (y a las otras dos variantes)  |
| Score                    | Eficiencia: bonus por movimientos sobrantes + entregas      | Distancia / cantidad de ranas a casa puro | Premia resolver limpio, no farmear; da una métrica de "skill" comparable en el leaderboard   |
| Carga por color          | Ranas y casas de color que deben coincidir                  | Cualquier rana a cualquier casa           | Aporta una capa de planificación (orden y ruta) que justifica el formato puzzle              |
| Reto principal           | Presupuesto de movimientos (sin timer)                      | Timer / vidas                             | Coherente con un puzzle por turnos donde el tiempo de reloj no debe presionar                |
| Niveles                  | Tableros fijos de datos inline + bucle de dificultad        | Generación procedural                     | Los puzzles deben ser resolubles y curados; lo procedural arriesga tableros imposibles       |
| Colisión                 | Retry del tablero (restaura presupuesto)                    | Perder vida / game over inmediato         | Mantiene el foco en resolver el puzzle, no en castigar un error de planeo                    |
| Ruta del juego           | Estática `app/games/frogger/play/page.tsx`                  | Dinámica `[id]/play/page.tsx`             | Aislamiento por juego; evita mezclar lógica de canvas con el placeholder genérico            |
| Comunicación juego→React | Callbacks en `initFrogger`                                  | Custom DOM events                         | Los callbacks son tipados, no requieren `addEventListener` en el componente                  |
| Reinicio                 | Remontar `<FroggerGame>` vía cambio de `key`                | Función `restart()` interna               | Estado limpio sin lógica extra en el módulo                                                  |
| Guardado de score        | Solo Supabase (`saveScore`)                                 | localStorage                              | Persistencia real; infraestructura ya existente (spec 06)                                    |

---

## Riesgos identificados

- **Loop zombie:** Si `destroy()` no cancela el RAF pendiente, al remontar el componente (JUGAR DE NUEVO) correrán dos loops en paralelo. Mitigación: guardar el id de `requestAnimationFrame` y cancelarlo en `destroy()`.
- **Listeners de teclado huérfanos:** Los listeners se agregan a `window`. Si el componente se desmonta sin llamar `destroy()`, siguen activos. Mitigación: el `useEffect` cleanup llama siempre a `controller.destroy()`.
- **Conflicto ruta estática vs dinámica:** Next.js da prioridad a `app/games/frogger/play/page.tsx` sobre `app/games/[id]/play/page.tsx`. Verificar que `/games/frogger/play` resuelve al archivo estático y que los demás juegos siguen resolviendo al placeholder dinámico.
- **Canvas fuera de pantalla en viewports pequeños:** El canvas es fijo 520×600 px. En pantallas más pequeñas desborda. Fuera de scope — documentado para spec futura de responsive/scaling.
- **Niveles irresolubles:** Un tablero mal diseñado podría no tener solución dentro del presupuesto, frustrando al jugador. Mitigación: validar cada tablero de `LEVELS` resolviéndolo manualmente al diseñarlo y dejar margen de movimientos.
- **Doble input durante la interpolación del tick:** Si el jugador martilla flechas mientras el tick se anima, podrían encolarse movimientos inconsistentes con el estado lógico. Mitigación: bloquear input mientras hay una interpolación en curso (cola de un solo movimiento) e ignorar `e.repeat`.
- **Desfase render vs lógica:** Como el RAF solo interpola, un bug podría dejar el dibujo desincronizado del estado autoritativo por celda. Mitigación: al terminar cada interpolación, redibujar desde el estado lógico (snap a celdas) para que el render siempre converja a la verdad.
