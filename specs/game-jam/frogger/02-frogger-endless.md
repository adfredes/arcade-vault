# 02-frogger-endless

**Estado:** Borrador
**Dependencias:** 05-asteroides-game (patrón de integración canvas↔React), 06-leaderboard-supabase (tablas `games`/`scores`, `saveScore`)
**Fecha:** 2026-06-24
**Objetivo:** Integrar Frogger como un cruce infinito con scroll (estilo Crossy Road): carriles generados proceduralmente que nunca terminan, una sola vida (un impacto = game over) y dificultad que crece de forma continua. El score se mide por distancia recorrida hacia adelante, con las "casas" convertidas en checkpoints que multiplican los puntos. Esta variante prioriza la rejugabilidad arcade y los scores altos para el Salón de la Fama.

---

## Scope

### Dentro del scope

- `lib/games/frogger.ts` — módulo TypeScript escrito desde cero; exporta `initFrogger(canvas, callbacks): FroggerController`
- `components/games/FroggerGame.tsx` — Client Component que monta el canvas, llama a `initFrogger`, y hace de puente entre el módulo y la play page
- `app/games/frogger/play/page.tsx` — ruta estática, play page dedicada; incluye HUD React (score, distancia, multiplicador), botón pausa y modal de game over con guardado en Supabase
- Insertar fila en tabla `games` de Supabase con id `frogger`

### Fuera del scope

- Autenticación de usuarios
- Controles táctiles / mobile
- Guardado de scores en localStorage (solo Supabase)
- Responsive del canvas (fijo a 520×640 px)
- Ranking en tiempo real / realtime
- Sonido
- Sprites con assets externos (formas/colores del canvas, estética neón CRT)
- Vidas múltiples (esta variante es de una sola vida: un impacto termina la partida)
- Niveles discretos (la dificultad escala de forma continua, no por niveles)

---

## Data Model

### Interfaz del módulo (`lib/games/frogger.ts`)

```ts
export interface FroggerCallbacks {
  onScoreChange: (score: number) => void;
  onDistanceChange: (rows: number) => void; // filas avanzadas (récord de avance)
  onMultiplierChange: (mult: number) => void; // multiplicador actual por checkpoints
  onGameOver: (finalScore: number) => void;
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

> No hay `onLivesChange` ni `onLevelChange`: la variante es de una sola vida y dificultad continua. `onDistanceChange` y `onMultiplierChange` alimentan un HUD enfocado en la rejugabilidad.

### Fila en tabla `games` (Supabase)

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'frogger',
  'FROGGER',
  'Cruza sin fin: cada carril te acerca al récord.',
  'Una rana, un cruce que nunca termina. Saltá hacia adelante esquivando vehículos y aguas traicioneras mientras el mundo scrollea sin descanso. Una sola vida: un solo impacto y se acaba. Cada checkpoint sube tu multiplicador, así que cuanto más lejos llegues, más vale cada salto.',
  'ARCADE',
  'cover-rana',
  'green'
);
```

> Las tablas `games` y `scores`, las RLS policies, y los helpers `saveScore`/`getTopScores`/`getGameStats` ya existen (spec 06) — no se modifican. `cover-rana` ya existe en `globals.css` — no se agrega regla nueva.

---

## Plan de implementación

1. **`lib/games/frogger.ts`** — escribir el módulo TypeScript desde cero:
   - Geometría: `const COLS = 13; const CELL = 40;` ⇒ canvas `W = 520`, `H = 640` (16 filas visibles). El mundo es una **lista infinita de filas** generadas hacia adelante.
   - Estado en variables de closure (no globales): `frog {col, worldRow, pxX}`, `score`, `farthestRow` (récord de avance, base del score), `multiplier`, `scrollY` (desplazamiento de cámara en píxeles), `scrollSpeed`, `rows` (Map de `worldRow → laneConfig`), `paused`, `dead`.
   - **Generación procedural de filas:** cada `worldRow` tiene un tipo: `safe` (pasto), `road` (carril de autos), `water` (carril de troncos/tortugas) o `checkpoint` (banda de casas). Generar bajo demanda al acercarse el borde superior visible; descartar filas que salieron por abajo. Reglas: no más de N filas peligrosas seguidas; alternar dirección/velocidad por fila.
   - **Scroll automático:** la cámara sube a `scrollSpeed` px/s (clamp de dt). La rana **debe avanzar**: si el scroll la alcanza por abajo (sale del borde inferior visible) ⇒ game over (mecánica "no te quedes atrás"). `scrollSpeed` crece lentamente con la distancia.
   - **Movimiento de la rana:** discreto, un salto por pulsación. `ArrowUp` avanza (sube récord), `ArrowDown` retrocede (sin penalización pero sin sumar récord), `ArrowLeft/Right` lateral. Avanzar a un `worldRow` nunca alcanzado: `farthestRow = worldRow`, `score = farthestRow * 10 * multiplier`-base, `onDistanceChange`/`onScoreChange`.
   - **Colisiones:** en `road`, choque con auto = game over (una sola vida). En `water`, no estar sobre tronco/tortuga (o tortuga sumergida) = game over. Estar sobre plataforma arrastra a la rana; si la arrastra fuera del canvas lateral = game over.
   - **Checkpoints:** las filas `checkpoint` aparecen cada K filas. Cruzar una: `multiplier++` (cap configurable), `onMultiplierChange`, y bonus fijo de score. El multiplicador eleva el valor de cada fila avanzada a partir de ahí.
   - **Score:** `score = baseDistance + sum(bonusCheckpoints)` donde `baseDistance` pondera filas avanzadas por el multiplicador vigente al ganarlas. Emitir `onScoreChange` en cada avance.
   - **Game over:** `dead = true`, `onGameOver(score)`, el loop se auto-detiene (no más `requestAnimationFrame`).
   - Loop RAF con **clamp de dt** (`dt = Math.min(dt, 0.05)` s) para mover carriles y scroll; el salto de la rana es por evento.
   - Listeners de teclado removibles: `window.addEventListener('keydown', handler)`; `GAME_KEYS = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'])` con `e.preventDefault()`. Ignorar `e.repeat` para mantener salto discreto.
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
   - `<canvas ref={canvasRef} width={520} height={640} style={{ display: 'block', maxWidth: '100%' }} />`

3. **`app/games/frogger/play/page.tsx`** — play page dedicada:
   - `'use client'`
   - Estado React: `score`, `distance`, `multiplier`, `paused`, `over`, `finalScore`, `playerName`, `saved`, `saving`, `gameKey`
   - Callbacks en `useCallback([])` para estabilidad de referencia
   - `gameRef = useRef<FroggerGameHandle>(null)` para controlar pausa/resume
   - Toggle de pausa: `gameRef.current?.pause()` / `gameRef.current?.resume()`
   - Restart: resetear estado React + `setGameKey(k => k + 1)` (remonta `<FroggerGame key={gameKey}>`)
   - `handleSave`: llama `saveScore('frogger', playerName, finalScore)` de `@/lib/supabase/saveScore`; gestiona estados `saving`/`saved`
   - HUD: SCORE, DISTANCIA (filas), MULTIPLICADOR (x N), botón PAUSA, botón SALIR
   - Shell CRT: clases `crt`, `crt-screen`, `crt-content`; `<FroggerGame>` va dentro de `crt-content`
   - Modal de game over: input de nombre (max 10 chars, mayúsculas), botón guardar (deshabilitado mientras `saving`), JUGAR DE NUEVO, VOLVER AL VAULT

4. **Insertar fila en `games`**:
   - Ejecutar el INSERT de Supabase vía MCP (`mcp__supabase__execute_sql`)

5. **Verificar TypeScript** — `tsc --noEmit` sin errores.

---

## Criterios de aceptación

- [ ] `/games/frogger` muestra la ficha del juego con título FROGGER y botón JUGAR AHORA
- [ ] `/games/frogger/play` carga sin errores y muestra el canvas 520×640 con el juego corriendo
- [ ] El HUD de React muestra SCORE, DISTANCIA y MULTIPLICADOR sincronizados con el estado interno del canvas
- [ ] Las flechas mueven la rana de a una celda por pulsación (salto discreto), sin scroll de página
- [ ] El mundo scrollea automáticamente y la velocidad de scroll crece con la distancia
- [ ] Quedarse atrás (salir por el borde inferior por no avanzar) provoca game over
- [ ] Las filas se generan proceduralmente hacia adelante sin que el cruce termine nunca
- [ ] Un solo impacto (auto, agua, tortuga sumergida o arrastre fuera del canvas) termina la partida (una sola vida)
- [ ] Avanzar a una fila nueva sube la DISTANCIA y el SCORE
- [ ] Cruzar un checkpoint incrementa el MULTIPLICADOR y suma bonus
- [ ] El botón PAUSA detiene el loop (incluido el scroll); REANUDAR lo reanuda
- [ ] Al morir aparece el modal de game over con la puntuación final
- [ ] El modal permite ingresar nombre (max 10 chars, mayúsculas) y guardar en Supabase
- [ ] El score guardado aparece en el leaderboard lateral de `/games/frogger` al recargar
- [ ] El score guardado aparece en el Salón de la Fama al recargar
- [ ] JUGAR DE NUEVO reinicia el juego desde cero (score 0, distancia 0, multiplicador x1)
- [ ] VOLVER AL VAULT navega a `/`
- [ ] La home (`/`) muestra el juego en el mini-rail
- [ ] `/games` muestra el juego en la grid
- [ ] `tsc --noEmit` sin errores
- [ ] Los juegos existentes (Asteroides, Tetris, Arkanoid, Snake) siguen funcionando sin errores de runtime

---

## Decisiones tomadas y descartadas

| Decisión                 | Elegida                                                  | Descartada                                 | Razón                                                                                           |
| ------------------------ | -------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Enfoque de esta variante | Cruce infinito con scroll, una vida, dificultad continua | Arcade fiel de 5 casas / puzzle por turnos | Máxima rejugabilidad y scores altos para el Hall of Fame; sesiones cortas y adictivas           |
| Score                    | Distancia recorrida × multiplicador por checkpoints      | Ranas a casa (variante clásica)            | Da una métrica continua e ilimitada, ideal para competir por récord                             |
| Vidas                    | Una sola (un impacto = game over)                        | 3 vidas con reset                          | Sube la tensión y favorece el "una más"; coherente con el estilo Crossy Road                    |
| Dificultad               | Escala continua (velocidad de scroll y carriles)         | Niveles discretos                          | No hay fin de nivel en un cruce infinito; el reto crece sin cortes                              |
| "No te quedes atrás"     | El scroll fuerza el avance; salir por abajo = game over  | Cámara libre que sigue solo a la rana      | Garantiza progreso constante y evita farmear filas seguras                                      |
| Generación de filas      | Procedural bajo demanda con reglas anti-frustración      | Mapa fijo precargado                       | Permite partidas infinitas y siempre distintas con coste de memoria acotado (descarte de filas) |
| Ruta del juego           | Estática `app/games/frogger/play/page.tsx`               | Dinámica `[id]/play/page.tsx`              | Aislamiento por juego; evita mezclar lógica de canvas con el placeholder genérico               |
| Comunicación juego→React | Callbacks en `initFrogger`                               | Custom DOM events                          | Los callbacks son tipados, no requieren `addEventListener` en el componente                     |
| Reinicio                 | Remontar `<FroggerGame>` vía cambio de `key`             | Función `restart()` interna                | Estado limpio sin lógica extra en el módulo                                                     |
| Guardado de score        | Solo Supabase (`saveScore`)                              | localStorage                               | Persistencia real; infraestructura ya existente (spec 06)                                       |

---

## Riesgos identificados

- **Loop zombie:** Si `destroy()` no cancela el RAF pendiente, al remontar el componente (JUGAR DE NUEVO) correrán dos loops en paralelo. Mitigación: guardar el id de `requestAnimationFrame` y cancelarlo en `destroy()`.
- **Listeners de teclado huérfanos:** Los listeners se agregan a `window`. Si el componente se desmonta sin llamar `destroy()`, siguen activos. Mitigación: el `useEffect` cleanup llama siempre a `controller.destroy()`.
- **Conflicto ruta estática vs dinámica:** Next.js da prioridad a `app/games/frogger/play/page.tsx` sobre `app/games/[id]/play/page.tsx`. Verificar que `/games/frogger/play` resuelve al archivo estático y que los demás juegos siguen resolviendo al placeholder dinámico.
- **Canvas fuera de pantalla en viewports pequeños:** El canvas es fijo 520×640 px. En pantallas más pequeñas desborda. Fuera de scope — documentado para spec futura de responsive/scaling.
- **Fuga de memoria por generación infinita:** Si las filas pasadas no se descartan, el Map crece sin límite. Mitigación: eliminar del Map las filas que salieron por debajo del borde inferior y cuya `worldRow` ya quedó atrás del récord.
- **Scroll injusto tras pausa/tab oculto:** Sin clamp de dt, al reanudar el scroll podría saltar y matar a la rana por "quedarse atrás" de golpe. Mitigación: `dt = Math.min(dt, 0.05)` y `resume()` resetea `lastTime`.
- **Generación procedural injugable:** Filas peligrosas consecutivas o carriles imposibles de cruzar harían el juego frustrante. Mitigación: reglas de generación (máximo de filas peligrosas seguidas, garantizar al menos un hueco/plataforma alcanzable por fila).
- **Salto sostenido (key repeat):** ignorar `keydown` con `e.repeat === true` para mantener el salto discreto.
